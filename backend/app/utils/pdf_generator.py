"""
PDF report generator using ReportLab.
Structure:
  1. Cover — title, table names, date
  2. Dataset Descriptions — per-table: filename, rows/cols, schema, quality
  3. Preprocessing Summary — what was auto-fixed and user-approved (from system messages)
  4. Q&A Session — user questions + AI answers with SQL, confidence, sources
"""
import io
import re
import base64
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image as RLImage, HRFlowable, PageBreak,
)

# ── Brand colours ────────────────────────────────────────────────────────────
BLUE   = HexColor("#3b82f6")
INDIGO = HexColor("#6366f1")
GREEN  = HexColor("#10b981")
AMBER  = HexColor("#f59e0b")
PURPLE = HexColor("#8b5cf6")
GRAY50 = HexColor("#f9fafb")
GRAY100= HexColor("#f3f4f6")
GRAY200= HexColor("#e5e7eb")
GRAY500= HexColor("#6b7280")
GRAY700= HexColor("#374151")
GRAY900= HexColor("#111827")
WHITE  = HexColor("#ffffff")


# ── Helpers ──────────────────────────────────────────────────────────────────

def sanitize_text(text: str) -> str:
    """Remove non-ASCII characters and escape HTML for ReportLab."""
    if not text:
        return ""
    text = re.sub(r"[^\x20-\x7E\n\t]", "", str(text))
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text)
    text = text.replace("\n", "<br/>")
    if len(text) > 3000:
        text = text[:3000] + "… [truncated — see full answer in app]"
    return text


def get_image_from_base64(base64_str: str, max_width: float = 420, max_height: float = 280):
    try:
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]
        img_data = base64.b64decode(base64_str)
        img_buffer = io.BytesIO(img_data)
        img = RLImage(img_buffer)
        w, h = img.imageWidth, img.imageHeight
        if w > max_width or h > max_height:
            ratio = min(max_width / float(w), max_height / float(h))
            img.drawWidth  = w * ratio
            img.drawHeight = h * ratio
        return img
    except Exception as e:
        print(f"PDF image decode error: {e}")
        return None


def _render_json_chart(chart_info: dict) -> str | None:
    """Render a JSON chart spec to a base64 PNG using matplotlib."""
    if not chart_info or not chart_info.get("data"):
        return None

    chart_type = chart_info.get("type", "bar")
    data = chart_info.get("data", [])
    x_key = chart_info.get("x_key")
    y_key = chart_info.get("y_key")
    title = chart_info.get("title", "Chart")

    if not x_key or not y_key or not data:
        return None

    # Handle multiple y_keys natively
    y_keys = y_key if isinstance(y_key, list) else [y_key]

    try:
        x_vals = [str(row.get(x_key, ""))[:20] for row in data]
        plt.style.use("default")
        fig, ax = plt.subplots(figsize=(7, 4))

        if chart_type == "bar":
            # Simple bar chart handling (only uses first y_key for now in PDF fallback to avoid complex grouped bars)
            y_vals = [float(row.get(y_keys[0], 0) or 0) for row in data]
            ax.bar(x_vals, y_vals, color="#3b82f6")
            ax.set_ylabel(y_keys[0])
            plt.xticks(rotation=45, ha="right")
        elif chart_type == "line":
            for yk in y_keys:
                y_vals = [float(row.get(yk, 0) or 0) for row in data]
                ax.plot(x_vals, y_vals, marker="o", label=yk)
            if len(y_keys) > 1:
                ax.legend()
            plt.xticks(rotation=45, ha="right")
        elif chart_type == "pie":
            y_vals = [float(row.get(y_keys[0], 0) or 0) for row in data]
            ax.pie(y_vals, labels=x_vals, autopct="%1.1f%%")
        elif chart_type == "scatter":
            y_vals = [float(row.get(y_keys[0], 0) or 0) for row in data]
            # Need numeric X for scatter, attempt conversion
            try:
                x_num = [float(x) for x in x_vals]
                ax.scatter(x_num, y_vals, color="#3b82f6")
            except:
                ax.scatter(x_vals, y_vals, color="#3b82f6")
        else:
            # Fallback to bar
            y_vals = [float(row.get(y_keys[0], 0) or 0) for row in data]
            ax.bar(x_vals, y_vals, color="#3b82f6")
            plt.xticks(rotation=45, ha="right")

        ax.set_title(title)
        plt.tight_layout()

        buf = io.BytesIO()
        plt.savefig(buf, format="png", dpi=150)
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode()
    except Exception as e:
        print(f"Error rendering JSON chart: {e}")
        return None


def _divider(story):
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GRAY200))
    story.append(Spacer(1, 10))


def _section_heading(story, text, styles):
    story.append(Spacer(1, 14))
    story.append(Paragraph(text, styles["h2"]))
    story.append(HRFlowable(width="100%", thickness=1.5, color=BLUE))
    story.append(Spacer(1, 8))


def _schema_table(cols: list) -> Table:
    """Build a styled schema table for one dataset."""
    data = [["Column Name", "Type", "Missing %", "Sample Values"]]
    for col in cols[:30]:
        samples = col.get("sample_values", [])
        sample_str = ", ".join(str(s) for s in samples[:3]) if samples else "—"
        data.append([
            sanitize_text(col.get("name", "")),
            col.get("type", ""),
            f"{col.get('missing_pct', 0):.1f}%",
            sanitize_text(sample_str[:60]),
        ])
    t = Table(data, colWidths=[140, 70, 65, 165])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0), BLUE),
        ("TEXTCOLOR",    (0, 0), (-1, 0), WHITE),
        ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, -1), 8),
        ("GRID",         (0, 0), (-1, -1), 0.4, GRAY200),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [GRAY50, WHITE]),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
    ]))
    return t


def _preprocessing_table(auto_fixes: list, applied_fixes: list) -> Table | None:
    data = [["Fix Type", "Action", "Rows Affected"]]
    for f in auto_fixes:
        data.append(["Auto (zero-risk)", sanitize_text(f.get("description", "")), "All matching"])
    for f in applied_fixes:
        data.append(["User-approved", sanitize_text(f.get("description", "")), str(f.get("rows_affected", "—"))])
    if len(data) == 1:
        return None
    t = Table(data, colWidths=[110, 240, 90])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0), PURPLE),
        ("TEXTCOLOR",    (0, 0), (-1, 0), WHITE),
        ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, -1), 8),
        ("GRID",         (0, 0), (-1, -1), 0.4, GRAY200),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#f5f3ff"), WHITE]),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
    ]))
    return t


# ── Main entry point ─────────────────────────────────────────────────────────

def generate_pdf_report(
    messages: list[dict],
    tables: dict,                  # { table_name: { schema, dataQuality, anomalies, filename, ... } }
    semantic_layer=None,
    template_info: dict | None = None,
    attachments: list[dict] | None = None,
) -> bytes:
    """Generate a structured PDF report and return as bytes."""

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    base_styles = getSampleStyleSheet()

    # ── Define all styles ────────────────────────────────────────────────────
    styles = {
        "title": ParagraphStyle("PDFTitle", parent=base_styles["Title"],
                                fontSize=26, textColor=BLUE, spaceAfter=6, alignment=TA_CENTER),
        "subtitle": ParagraphStyle("PDFSub", parent=base_styles["Normal"],
                                   fontSize=11, textColor=GRAY500, spaceAfter=4, alignment=TA_CENTER),
        "h2": ParagraphStyle("PDFH2", parent=base_styles["Normal"],
                             fontSize=14, fontName="Helvetica-Bold", textColor=GRAY900,
                             spaceBefore=6, spaceAfter=4),
        "h3": ParagraphStyle("PDFH3", parent=base_styles["Normal"],
                             fontSize=11, fontName="Helvetica-Bold", textColor=GRAY700,
                             spaceBefore=8, spaceAfter=4),
        "body": ParagraphStyle("PDFBody", parent=base_styles["Normal"],
                               fontSize=9, textColor=GRAY700, spaceAfter=4, leading=13),
        "question": ParagraphStyle("PDFQuestion", parent=base_styles["Normal"],
                                   fontSize=10, fontName="Helvetica-Bold", textColor=BLUE,
                                   spaceBefore=14, spaceAfter=4),
        "answer": ParagraphStyle("PDFAnswer", parent=base_styles["Normal"],
                                 fontSize=9, textColor=GRAY700, spaceAfter=6,
                                 leftIndent=12, leading=13),
        "meta": ParagraphStyle("PDFMeta", parent=base_styles["Normal"],
                               fontSize=8, textColor=GRAY500, spaceAfter=4, leftIndent=12),
        "code": ParagraphStyle("PDFCode", parent=base_styles["Normal"],
                               fontSize=7, fontName="Courier", textColor=GRAY700,
                               backColor=GRAY100, borderPadding=4,
                               spaceBefore=4, spaceAfter=4, leftIndent=12),
        "footer": ParagraphStyle("PDFFooter", parent=base_styles["Normal"],
                                 fontSize=8, textColor=GRAY500, alignment=TA_CENTER),
        "tag": ParagraphStyle("PDFTag", parent=base_styles["Normal"],
                              fontSize=8, textColor=INDIGO, spaceAfter=2),
    }

    story = []

    # ════════════════════════════════════════════════════════════════════════
    # 1. COVER
    # ════════════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 60))
    story.append(Paragraph("DataTalk", styles["title"]))
    story.append(Paragraph("Analysis Report", styles["subtitle"]))
    story.append(Spacer(1, 6))

    table_names = list(tables.keys())
    if table_names:
        tables_label = " &amp; ".join(sanitize_text(n) for n in table_names)
        story.append(Paragraph(f"Datasets: <b>{tables_label}</b>", styles["subtitle"]))

    story.append(Paragraph(
        f"Generated: {datetime.now().strftime('%d %B %Y, %H:%M')}",
        styles["subtitle"],
    ))

    if template_info:
        story.append(Spacer(1, 10))
        for key, label in [("author", "Author"), ("company", "Company"), ("date", "Date")]:
            if template_info.get(key):
                story.append(Paragraph(f"<b>{label}:</b> {sanitize_text(template_info[key])}", styles["body"]))
        if template_info.get("executive_summary"):
            story.append(Spacer(1, 8))
            story.append(Paragraph("<b>Executive Summary</b>", styles["h3"]))
            story.append(Paragraph(sanitize_text(template_info["executive_summary"]), styles["body"]))

    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════════════════
    # 2. DATASET DESCRIPTIONS (one section per table)
    # ════════════════════════════════════════════════════════════════════════
    if tables:
        _section_heading(story, "Dataset Descriptions", styles)

        for table_name, meta in tables.items():
            schema  = meta.get("schema", [])
            quality = meta.get("data_quality") or meta.get("dataQuality") or {}
            filename = meta.get("filename", table_name)

            # Row count — backend stores df, frontend passes rowCount
            df = meta.get("df")
            row_count = (
                meta.get("rowCount") or
                meta.get("row_count") or
                (len(df) if df is not None else None)
            )
            row_str = f"{row_count:,}" if isinstance(row_count, int) else "—"

            # Table header
            story.append(Paragraph(f"Table: <b>{sanitize_text(table_name)}</b>", styles["h3"]))
            story.append(Paragraph(
                f"File: {sanitize_text(filename)}  |  "
                f"Rows: {row_str}  |  "
                f"Columns: {len(schema)}  |  "
                f"Quality Score: {quality.get('overall_score', 100)}%",
                styles["body"],
            ))
            story.append(Spacer(1, 6))

            if schema:
                story.append(_schema_table(schema))
            story.append(Spacer(1, 14))

    # ════════════════════════════════════════════════════════════════════════
    # 3. PREPROCESSING SUMMARY (extracted from system messages)
    # ════════════════════════════════════════════════════════════════════════
    system_msgs = [m for m in messages if m.get("role") == "system"]
    has_preprocessing = any(
        m.get("preprocessing_report") and (
            m["preprocessing_report"].get("auto_fixes") or
            m["preprocessing_report"].get("applied_fixes")
        )
        for m in system_msgs
    )
    has_anomalies = any(m.get("anomalies") for m in system_msgs)

    if has_preprocessing or has_anomalies:
        _section_heading(story, "Data Preprocessing & Quality Checks", styles)

        for msg in system_msgs:
            # File label
            content = msg.get("content", "")
            file_label = ""
            if "as table" in content:
                # e.g. "Loaded customers.csv as table `customers`"
                match = re.search(r'\*\*(.+?)\*\* as table', content)
                if match:
                    file_label = match.group(1)

            if file_label:
                story.append(Paragraph(f"<b>{sanitize_text(file_label)}</b>", styles["h3"]))

            # Preprocessing table
            pre = msg.get("preprocessing_report", {})
            auto_fixes    = pre.get("auto_fixes", [])
            applied_fixes = pre.get("applied_fixes", [])

            if auto_fixes or applied_fixes:
                pt = _preprocessing_table(auto_fixes, applied_fixes)
                if pt:
                    story.append(pt)
                    story.append(Spacer(1, 8))
            else:
                story.append(Paragraph("No preprocessing changes were needed — data was already clean.", styles["body"]))
                story.append(Spacer(1, 6))

            # Anomalies
            anomalies = msg.get("anomalies", [])
            if anomalies:
                story.append(Paragraph("Anomaly Detection Results", styles["h3"]))
                anom_data = [["Column", "Suspicious Rows", "Detail"]]
                for a in anomalies:
                    anom_data.append([
                        sanitize_text(a.get("column", "")),
                        str(a.get("count", "")),
                        sanitize_text(a.get("message", "")),
                    ])
                at = Table(anom_data, colWidths=[100, 90, 250])
                at.setStyle(TableStyle([
                    ("BACKGROUND",   (0, 0), (-1, 0), AMBER),
                    ("TEXTCOLOR",    (0, 0), (-1, 0), WHITE),
                    ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE",     (0, 0), (-1, -1), 8),
                    ("GRID",         (0, 0), (-1, -1), 0.4, GRAY200),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#fffbeb"), WHITE]),
                    ("TOPPADDING",   (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
                ]))
                story.append(at)
                story.append(Spacer(1, 10))

        _divider(story)

    # ════════════════════════════════════════════════════════════════════════
    # 4. Q&A SESSION
    # ════════════════════════════════════════════════════════════════════════
    qa_msgs = [m for m in messages if m.get("role") in ("user", "assistant")]

    if qa_msgs:
        _section_heading(story, "Question &amp; Answer Session", styles)

        q_count = 0
        for idx, msg in enumerate(messages):
            role = msg.get("role", "")

            if role == "user":
                q_count += 1
                story.append(Paragraph(
                    f"Q{q_count}: {sanitize_text(msg.get('content', ''))}",
                    styles["question"],
                ))

            elif role == "assistant":
                content = sanitize_text(msg.get("content", ""))
                if content:
                    story.append(Paragraph(f"A: {content}", styles["answer"]))

                # Chart / matplotlib image
                # 1. Multiple images (Python)
                added_chart = False
                images = msg.get("matplotlib_images")
                if images and isinstance(images, list):
                    for img_b64 in images:
                        img = get_image_from_base64(img_b64)
                        if img:
                            story.append(Spacer(1, 6))
                            story.append(img)
                            story.append(Spacer(1, 6))
                            added_chart = True
                
                # 2. Legacy / singular image property
                if not added_chart:
                    for img_key in ("matplotlib_image", "image"):
                        img_b64 = msg.get(img_key)
                        if img_b64:
                            img = get_image_from_base64(img_b64)
                            if img:
                                story.append(Spacer(1, 6))
                                story.append(img)
                                story.append(Spacer(1, 6))
                                added_chart = True
                            break

                # 3. SQL / Recharts JSON properties
                if not added_chart and msg.get("chart"):
                    rendered_b64 = _render_json_chart(msg.get("chart"))
                    if rendered_b64:
                        img = get_image_from_base64(rendered_b64)
                        if img:
                            story.append(Spacer(1, 6))
                            story.append(img)
                            story.append(Spacer(1, 6))
                # Attachments
                if attachments:
                    for att in attachments:
                        if att.get("message_index") == idx and att.get("data"):
                            img = get_image_from_base64(att["data"])
                            if img:
                                story.append(Spacer(1, 6))
                                story.append(img)
                                story.append(Spacer(1, 6))

                # SQL query
                sql = msg.get("sql_query")
                if sql:
                    story.append(Paragraph(f"SQL: {sanitize_text(sql)}", styles["code"]))

                # Confidence
                conf = msg.get("confidence")
                if conf:
                    score = conf.get("score", conf.get("value", "N/A"))
                    level = conf.get("level", "")
                    story.append(Paragraph(
                        f"Confidence: {score}%  {level}",
                        styles["meta"],
                    ))

                # Sources
                sources = msg.get("sources", [])
                if sources:
                    parsed = []
                    for s in sources:
                        if isinstance(s, dict):
                            title = s.get("value") or s.get("title") or s.get("name") or "Source"
                            url   = s.get("url", "")
                            safe_title = sanitize_text(title)
                            parsed.append(f'<a href="{url}" color="#3b82f6"><u>{safe_title}</u></a>' if url else safe_title)
                        elif isinstance(s, str):
                            parsed.append(sanitize_text(s))
                    story.append(Paragraph(f"Sources: {', '.join(parsed)}", styles["meta"]))

                _divider(story)

    # ════════════════════════════════════════════════════════════════════════
    # FOOTER
    # ════════════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 20))
    story.append(Paragraph(
        "Generated by DataTalk  |  NatWest Code for Purpose Hackathon",
        styles["footer"],
    ))

    doc.build(story)
    return buffer.getvalue()
