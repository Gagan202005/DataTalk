/**
 * PDF report generator using pdfkit.
 * Mirrors the structure of Python backend/app/utils/pdf_generator.py.
 */
import PDFDocument from 'pdfkit';

const BLUE = '#3b82f6';
const INDIGO = '#6366f1';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const GRAY500 = '#6b7280';
const GRAY700 = '#374151';
const GRAY900 = '#111827';
const WHITE = '#ffffff';
const GRAY100 = '#f3f4f6';

function sanitizeText(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/[^\x20-\x7E\n\t]/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1');
}

function markdownToText(text: string): string {
  return sanitizeText(text)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^- /gm, '• ');
}

function drawHorizontalRule(doc: PDFKit.PDFDocument, y: number): void {
  doc.moveTo(54, y).lineTo(doc.page.width - 54, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  cells: string[],
  widths: number[],
  x: number,
  y: number,
  bgColor: string,
  textColor: string,
  fontSize = 8,
): number {
  const ROW_HEIGHT = 18;
  doc.rect(x, y, widths.reduce((a, b) => a + b, 0), ROW_HEIGHT).fillColor(bgColor).fill();
  doc.fillColor(textColor).fontSize(fontSize);
  let cx = x;
  cells.forEach((cell, i) => {
    doc.text(sanitizeText(cell ?? '').slice(0, 60), cx + 3, y + 4, { width: widths[i] - 6, lineBreak: false });
    cx += widths[i];
  });
  return y + ROW_HEIGHT;
}

function drawTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  widths: number[],
  startX: number,
  startY: number,
): number {
  let y = drawTableRow(doc, headers, widths, startX, startY, BLUE, WHITE, 8);
  rows.forEach((row, i) => {
    const bg = i % 2 === 0 ? '#f9fafb' : WHITE;
    y = drawTableRow(doc, row, widths, startX, y, bg, GRAY700, 8);
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 54;
    }
  });
  return y;
}

export function generatePdfReport(opts: {
  messages: Record<string, any>[];
  tables: Record<string, any>;
  semanticLayer?: any;
  template_info?: Record<string, any> | null;
  attachments?: Array<{ message_index?: number; data: string; content_type?: string }> | null;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { messages, tables, template_info, attachments } = opts;

    const doc = new PDFDocument({ size: 'A4', margin: 54, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - 108;
    const leftMargin = 54;

    // ─── COVER ───────────────────────────────────────────────────────────────
    doc.moveDown(4);
    doc.fontSize(26).fillColor(BLUE).text('DataTalk', { align: 'center' });
    doc.fontSize(12).fillColor(GRAY500).text('Analysis Report', { align: 'center' });
    doc.moveDown(0.5);

    const tableNames = Object.keys(tables);
    if (tableNames.length > 0) {
      doc.fontSize(10).fillColor(GRAY500).text(`Datasets: ${tableNames.join(' & ')}`, { align: 'center' });
    }

    doc.fontSize(9).fillColor(GRAY500).text(
      `Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      { align: 'center' },
    );

    if (template_info) {
      doc.moveDown(1);
      if (template_info.author) doc.fontSize(10).fillColor(GRAY700).text(`Author: ${sanitizeText(template_info.author)}`);
      if (template_info.company) doc.fontSize(10).fillColor(GRAY700).text(`Company: ${sanitizeText(template_info.company)}`);
      if (template_info.executive_summary) {
        doc.moveDown(0.5).fontSize(11).fillColor(GRAY900).text('Executive Summary', { underline: true });
        doc.fontSize(9).fillColor(GRAY700).text(sanitizeText(template_info.executive_summary), { width: contentWidth });
      }
    }

    doc.addPage();

    // ─── DATASET DESCRIPTIONS ────────────────────────────────────────────────
    if (tableNames.length > 0) {
      doc.fontSize(14).fillColor(GRAY900).text('Dataset Descriptions', leftMargin, 54, { underline: false });
      drawHorizontalRule(doc, doc.y + 2);
      doc.moveDown(0.5);

      for (const [tableName, meta] of Object.entries(tables)) {
        const schema: any[] = meta.schema ?? [];
        const quality: any = meta.data_quality ?? meta.dataQuality ?? {};
        const filename = meta.filename ?? tableName;
        const rowCount = meta.row_count ?? meta.rowCount ?? (meta.rows ? meta.rows.length : '—');

        doc.fontSize(11).fillColor(GRAY900).text(`Table: ${tableName}`);
        doc.fontSize(8).fillColor(GRAY700).text(
          `File: ${filename}  |  Rows: ${typeof rowCount === 'number' ? rowCount.toLocaleString() : rowCount}  |  Columns: ${schema.length}  |  Quality Score: ${quality.overall_score ?? 100}%`,
        );
        doc.moveDown(0.3);

        if (schema.length > 0) {
          const schemaRows = schema.slice(0, 30).map((col: any) => [
            col.name ?? '',
            col.type ?? '',
            `${col.missing_pct ?? 0}%`,
            (col.sample_values ?? []).slice(0, 3).join(', ').slice(0, 50),
          ]);
          drawTable(doc, ['Column Name', 'Type', 'Missing %', 'Sample Values'], schemaRows, [130, 70, 65, 165], leftMargin, doc.y);
        }
        doc.moveDown(1);
      }

      doc.addPage();
    }

    // ─── Q&A SESSION ─────────────────────────────────────────────────────────
    const qaMsgs = messages.filter((m) => m.role === 'user' || m.role === 'assistant');

    if (qaMsgs.length > 0) {
      doc.fontSize(14).fillColor(GRAY900).text('Question & Answer Session', leftMargin, 54);
      drawHorizontalRule(doc, doc.y + 2);
      doc.moveDown(0.5);

      let qCount = 0;
      messages.forEach((msg, idx) => {
        if (doc.y > doc.page.height - 100) doc.addPage();

        if (msg.role === 'user') {
          qCount++;
          doc.fontSize(10).fillColor(BLUE).text(`Q${qCount}: ${sanitizeText(msg.content ?? '')}`, { width: contentWidth });
          doc.moveDown(0.3);
        } else if (msg.role === 'assistant') {
          const content = markdownToText(msg.content ?? msg.answer ?? '');
          if (content) {
            doc.fontSize(9).fillColor(GRAY700).text(`A: ${content.slice(0, 2000)}`, { width: contentWidth, lineGap: 2 });
          }

          // Images
          const images: string[] = msg.matplotlib_images ?? (msg.matplotlib_image ? [msg.matplotlib_image] : []);
          for (const b64 of images) {
            try {
              const imgBuf = Buffer.from(b64.includes(',') ? b64.split(',')[1] : b64, 'base64');
              const img = doc.openImage(imgBuf);
              const targetWidth = Math.min(400, contentWidth);
              const scaledHeight = img.height * (targetWidth / img.width);
              
              doc.moveDown(0.5);
              if (doc.y + scaledHeight > doc.page.height - 54) doc.addPage();
              
              const xPos = leftMargin + (contentWidth - targetWidth) / 2;
              doc.image(imgBuf, xPos, doc.y, { width: targetWidth });
              doc.y += scaledHeight;
              doc.moveDown(0.5);
            } catch { /* skip bad image */ }
          }

          // SQL
          if (msg.sql_query) {
            doc.fontSize(7).fillColor(GRAY700).font('Courier')
              .text(`SQL: ${sanitizeText(msg.sql_query).slice(0, 500)}`, { width: contentWidth });
            doc.font('Helvetica');
          }



          // Attachments
          if (attachments) {
            for (const att of attachments) {
              if (att.message_index === idx && att.data) {
                try {
                  const imgBuf = Buffer.from(att.data.includes(',') ? att.data.split(',')[1] : att.data, 'base64');
                  const img = doc.openImage(imgBuf);
                  const targetWidth = Math.min(400, contentWidth);
                  const scaledHeight = img.height * (targetWidth / img.width);
                  
                  doc.moveDown(0.5);
                  if (doc.y + scaledHeight > doc.page.height - 54) doc.addPage();
                  
                  const xPos = leftMargin + (contentWidth - targetWidth) / 2;
                  doc.image(imgBuf, xPos, doc.y, { width: targetWidth });
                  doc.y += scaledHeight;
                  doc.moveDown(0.5);
                } catch { /* skip */ }
              }
            }
          }

          doc.moveDown(0.5);
          drawHorizontalRule(doc, doc.y);
          doc.moveDown(0.5);
        }
      });
    }

    // ─── FOOTER ──────────────────────────────────────────────────────────────
    doc.moveDown(2);
    doc.fontSize(8).fillColor(GRAY500)
      .text('Generated by DataTalk  |  NatWest Code for Purpose Hackathon', { align: 'center' });

    doc.end();
  });
}
