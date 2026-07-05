/**
 * POST /api/export-pdf — Generate PDF report
 */
import { Router, Request, Response } from 'express';
import { sessions } from '../sessions';
import { generatePdfReport } from '../utils/pdfGenerator';

const router = Router();

router.post('/export-pdf', async (req: Request, res: Response): Promise<void> => {
  try {
    const { session_id, messages = [], template_info = null, attachments = null } = req.body;

    if (!session_id || !sessions.has(session_id)) {
      res.status(404).json({ detail: 'Session not found.' });
      return;
    }

    const session = sessions.get(session_id)!;
    const tables = session.tables ?? {};

    const pdfBytes = await generatePdfReport({ messages, tables, template_info, attachments });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=DataTalk_Report.pdf');
    res.send(pdfBytes);
  } catch (e: any) {
    res.status(500).json({ detail: `PDF generation failed: ${e.message}` });
  }
});

export default router;
