/**
 * POST /api/upload — File upload endpoint.
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { sessions } from '../sessions';
import { parseBuffer } from '../core/fileHandler';
import { detectIssues } from '../core/preprocessor';
import { config } from '../config';
import fs from 'fs';

fs.mkdirSync(config.uploadDir, { recursive: true });

const upload = multer({
  dest: config.uploadDir,
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
});

const router = Router();

router.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ detail: 'No file uploaded.' });
      return;
    }

    const filename = (req.file as Express.Multer.File & { originalname: string }).originalname || 'upload.csv';
    const buffer = fs.readFileSync(file.path);
    fs.unlinkSync(file.path); // clean up temp file

    let rows;
    try {
      rows = parseBuffer(buffer, filename);
    } catch (e: any) {
      res.status(400).json({ detail: e.message });
      return;
    }

    const [cleanedRows, autoFixes, mediumIssues] = detectIssues(rows);
    const sessionId = (req.body.session_id as string) || '';

    let finalSessionId: string;
    if (sessionId && sessions.has(sessionId)) {
      sessions.get(sessionId)!.dfPreprocessed = cleanedRows;
      sessions.get(sessionId)!.pendingFilename = filename;
      finalSessionId = sessionId;
    } else {
      finalSessionId = uuidv4();
      sessions.set(finalSessionId, { dfPreprocessed: cleanedRows, filename });
    }

    res.json({
      temp_id: finalSessionId,
      filename,
      row_count: cleanedRows.length,
      column_count: cleanedRows.length > 0 ? Object.keys(cleanedRows[0]).length : 0,
      auto_fixes: autoFixes,
      issues: mediumIssues,
    });
  } catch (e: any) {
    res.status(500).json({ detail: `Internal error: ${e.message}` });
  }
});

export default router;
