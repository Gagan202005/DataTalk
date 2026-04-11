"""
PDF report generator using ReportLab.
Creates a professional Q&A session report with schema, answers, confidence, and sources.
"""
import io
import re
import base64
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage


def get_image_from_base64(base64_str: str, max_width: float = 400, max_height: float = 300):
    try:
        # Strip data URL prefix if present
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]
            
        img_data = base64.b64decode(base64_str)
        img_buffer = io.BytesIO(img_data)
        
        img = RLImage(img_buffer)
        
        # Scale down if necessary maintaining aspect ratio
        img_width = img.imageWidth
        img_height = img.imageHeight
        
        if img_width > max_width or img_height > max_height:
            ratio = min(max_width / float(img_width), max_height / float(img_height))
            img.drawWidth = img_width * ratio
            img.drawHeight = img_height * ratio
            
        return img
    except Exception as e:
        print(f"Error decoding image: {e}")
        return None


def sanitize_text(text: str) -> str:
    """Remove non-ASCII characters and problematic symbols for ReportLab."""
    if not text:
        return ""
    # Remove non-printable characters
    text = re.sub(r"[^\x20-\x7E\n\t]", "", str(text))
    # Escape HTML special chars for ReportLab paragraph rendering
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    
    # Convert basic markdown for ReportLab
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', text) # bold
    text = re.sub(r'\*(.*?)\*', r'<i>\1</i>', text) # italic
    
    # Replace newlines with breaks
    text = text.replace("\n", "<br/>")

    # Truncate very long text
    if len(text) > 4000:
        text = text[:4000] + "... [See full answer in app]"
    return text


def generate_pdf_report(
    messages: list[dict],
    filename: str,
    schema: list[dict],
    semantic_layer=None,
    template_info: dict | None = None,
    attachments: list[dict] | None = None,
) -> bytes:
    """Generate a full PDF report and return as bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        fontSize=24,
        textColor=HexColor("#3b82f6"),
        spaceAfter=12,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=HexColor("#94a3b8"),
        spaceAfter=20,
    )
    question_style = ParagraphStyle(
        "Question",
        parent=styles["Normal"],
        fontSize=11,
        textColor=HexColor("#3b82f6"),
        fontName="Helvetica-Bold",
        spaceBefore=16,
        spaceAfter=4,
    )
    answer_style = ParagraphStyle(
        "Answer",
        parent=styles["Normal"],
        fontSize=10,
        textColor=HexColor("#1f2937"),
        spaceBefore=4,
        spaceAfter=8,
        leftIndent=12,
    )
    code_style = ParagraphStyle(
        "Code",
        parent=styles["Normal"],
        fontSize=8,
        fontName="Courier",
        textColor=HexColor("#1f2937"),
        backColor=HexColor("#f3f4f6"),
        borderPadding=6,
        spaceBefore=6,
        spaceAfter=6,
        leftIndent=12,
        rightIndent=12,
    )
    answer_style = ParagraphStyle(
        "Answer",
        parent=styles["Normal"],
        fontSize=10,
        textColor=HexColor("#1f2937"),
        spaceBefore=4,
        spaceAfter=8,
        leftIndent=12,
    )
    meta_style = ParagraphStyle(
        "Meta",
        parent=styles["Normal"],
        fontSize=8,
        textColor=HexColor("#6b7280"),
        spaceBefore=2,
        spaceAfter=12,
        leftIndent=12,
    )

    story = []

    # ── Title ──────────────────────────────────────────────────────────────
    story.append(Paragraph("DataTalk Analysis Report", title_style))
    story.append(Paragraph(f"Dataset: {sanitize_text(filename)}", subtitle_style))

    # ── Template Info ──────────────────────────────────────────────────────
    if template_info:
        if template_info.get("author"):
            story.append(Paragraph(f"<b>Author:</b> {sanitize_text(template_info['author'])}", styles["Normal"]))
        if template_info.get("company"):
            story.append(Paragraph(f"<b>Company:</b> {sanitize_text(template_info['company'])}", styles["Normal"]))
        if template_info.get("date"):
            story.append(Paragraph(f"<b>Date:</b> {sanitize_text(template_info['date'])}", styles["Normal"]))
        if template_info.get("executive_summary"):
            story.append(Spacer(1, 10))
            story.append(Paragraph("<b>Executive Summary</b>", styles["Heading3"]))
            story.append(Paragraph(sanitize_text(template_info["executive_summary"]), styles["Normal"]))
        story.append(Spacer(1, 20))

    # ── Schema table ────────────────────────────────────────────────────────
    if schema:
        story.append(Paragraph("Dataset Schema", styles["Heading2"]))
        table_data = [["Column", "Type", "Missing %"]]
        for col in schema[:20]:  # Limit to 20 columns
            table_data.append([
                sanitize_text(col["name"]),
                col["type"],
                f"{col['missing_pct']}%",
            ])

        t = Table(table_data, colWidths=[200, 100, 80])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#3b82f6")),
            ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#ffffff")),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#e5e7eb")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#f9fafb"), HexColor("#ffffff")]),
        ]))
        story.append(t)
        story.append(Spacer(1, 20))

    # ── Q&A pairs ───────────────────────────────────────────────────────────
    if messages:
        story.append(Paragraph("Question &amp; Answer Session", styles["Heading2"]))

        for idx, msg in enumerate(messages):
            role = msg.get("role", "")
            content = sanitize_text(msg.get("content", ""))

            if role == "system":
                # Show anomaly detection results from upload message
                anomalies = msg.get("anomalies", [])
                if anomalies:
                    story.append(Paragraph("Anomaly Detection Results", styles["Heading3"]))
                    anomaly_data = [["Column", "Suspicious Rows", "Detail"]]
                    for a in anomalies:
                        anomaly_data.append([
                            sanitize_text(a.get("column", "")),
                            str(a.get("count", "")),
                            sanitize_text(a.get("message", "")),
                        ])
                    at = Table(anomaly_data, colWidths=[100, 100, 220])
                    at.setStyle(TableStyle([
                        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#f59e0b")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#ffffff")),
                        ("FONTSIZE", (0, 0), (-1, -1), 9),
                        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#e5e7eb")),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#fffbeb"), HexColor("#ffffff")]),
                    ]))
                    story.append(at)
                    story.append(Spacer(1, 12))
            elif role == "user":
                story.append(Paragraph(f"Q: {content}", question_style))
            elif role == "assistant":
                story.append(Paragraph(f"A: {content}", answer_style))

                if "image" in msg and msg["image"]:
                    img = get_image_from_base64(msg["image"])
                    if img:
                        story.append(Spacer(1, 10))
                        story.append(img)
                        story.append(Spacer(1, 10))
                # Support matplotlib_image passed from frontend message history
                elif "matplotlib_image" in msg and msg["matplotlib_image"]:
                    img = get_image_from_base64(msg["matplotlib_image"])
                    if img:
                        story.append(Spacer(1, 10))
                        story.append(img)
                        story.append(Spacer(1, 10))

                if attachments:
                    for att in attachments:
                        if att.get("message_index") == idx and att.get("data"):
                            img = get_image_from_base64(att["data"])
                            if img:
                                story.append(Spacer(1, 10))
                                story.append(img)
                                story.append(Spacer(1, 10))

                # Confidence info
                conf = msg.get("confidence")
                if conf:
                    story.append(Paragraph(
                        f"Confidence: {conf.get('score', 'N/A')}% ({conf.get('level', 'N/A')})",
                        meta_style,
                    ))

                # Sources
                sources = msg.get("sources", [])
                if sources:
                    parsed_sources = []
                    for s in sources:
                        if isinstance(s, dict):
                            title = s.get("title") or s.get("name") or s.get("value") or s.get("url") or "Web Source"
                            url = s.get("url")
                            
                            safe_title = sanitize_text(title)
                            if url:
                                safe_url = sanitize_text(url)
                                parsed_sources.append(f'<a href="{safe_url}" color="#3b82f6"><u>{safe_title}</u></a>')
                            else:
                                parsed_sources.append(safe_title)
                        elif isinstance(s, str):
                            parsed_sources.append(sanitize_text(s))
                            
                    source_text = ", ".join(parsed_sources)
                    story.append(Paragraph(
                        f"Sources: {source_text}", meta_style
                    ))

                # SQL query
                sql = msg.get("sql_query")
                if sql:
                    story.append(Paragraph(f"SQL: {sanitize_text(sql)}", meta_style))

    # ── Footer ──────────────────────────────────────────────────────────────
    story.append(Spacer(1, 30))
    story.append(Paragraph(
        "Generated by DataTalk | NatWest Code for Purpose Hackathon",
        ParagraphStyle(
            "Footer",
            parent=styles["Normal"],
            fontSize=8,
            textColor=HexColor("#94a3b8"),
            alignment=TA_CENTER,
        ),
    ))

    doc.build(story)
    return buffer.getvalue()
