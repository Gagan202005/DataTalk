/**
 * POST /api/preprocess/apply — Apply approved fixes and load into DuckDB.
 * GET  /api/preprocess/download/:id — Download cleaned CSV.
 */
import { Router, Request, Response } from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import Papa from 'papaparse';
import { sessions } from '../sessions';
import { applyDecisions } from '../core/preprocessor';
import { DatabaseManager } from '../core/database';
import { extractSchema, assessDataQuality, suggestMetrics, detectAnomalies } from '../core/schema';
import { rowsToCsvBytes } from '../core/fileHandler';

const SQL_RESERVED = new Set(['order','group','table','select','where','from','join','index','data','values','key','column','columns','row','rows','update','insert','delete','create','drop','alter','view','set','by','in','is','as','on','and','or','not','null','true','false']);

function sanitizeTableName(filename: string, existing: Set<string>): string {
  let name = filename.replace(/\.[^.]+$/, '').toLowerCase().trim()
    .replace(/[\s\-]+/g, '_').replace(/[^\w]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'table';
  if (SQL_RESERVED.has(name) || /^\d/.test(name)) name = `tbl_${name}`;
  const base = name;
  let counter = 2;
  while (existing.has(name)) { name = `${base}_${counter++}`; }
  return name;
}

const router = Router();

router.post('/preprocess/apply', async (req: Request, res: Response): Promise<void> => {
  try {
    const { session_id, approved_step_ids = [], table_name: requestedTableName } = req.body;

    if (!session_id || !sessions.has(session_id)) {
      res.status(404).json({ detail: 'Session not found' });
      return;
    }

    const session = sessions.get(session_id)!;
    const rows = session.dfPreprocessed;
    if (!rows) {
      res.status(404).json({ detail: 'No pending data found for session' });
      return;
    }

    const [cleanedRows, results] = applyDecisions(rows, approved_step_ids);
    const filename = session.pendingFilename ?? session.filename ?? 'unknown.csv';
    const isExisting = !!session.tables;
    const existingNames = new Set(Object.keys(session.tables ?? {}));
    const tableName: string = requestedTableName ?? sanitizeTableName(filename, existingNames);

    const schema = extractSchema(cleanedRows);
    const quality = assessDataQuality(cleanedRows);
    const suggestions = suggestMetrics(cleanedRows);
    const anomalies = detectAnomalies(cleanedRows);

    // Write cleaned rows to temp CSV for DuckDB loading
    const tmpCsv = path.join(os.tmpdir(), `datatalk_${session_id}_${Date.now()}.csv`);
    fs.writeFileSync(tmpCsv, Papa.unparse(cleanedRows));

    if (isExisting) {
      const db = session.db!;
      await db.loadFromCsv(tmpCsv, tableName);
      fs.unlinkSync(tmpCsv);


      session.tables![tableName] = { rows: cleanedRows, schema, data_quality: quality, anomalies, filename };
      delete session.dfPreprocessed;
      delete session.pendingFilename;
    } else {
      const db = new DatabaseManager(session_id);
      await db.loadFromCsv(tmpCsv, tableName);
      fs.unlinkSync(tmpCsv);

      sessions.set(session_id, {
        db, tables: { [tableName]: { rows: cleanedRows, schema, data_quality: quality, anomalies, filename } },
        messages: [], cache: {},
      });
    }

    res.json({
      session_id, table_name: tableName, filename,
      row_count: cleanedRows.length,
      column_count: cleanedRows.length > 0 ? Object.keys(cleanedRows[0]).length : 0,
      schema, data_quality: quality, suggested_metrics: suggestions, anomalies,
      preprocessing_report: results,
    });
  } catch (e: any) {
    res.status(500).json({ detail: `Preprocess error: ${e.message}` });
  }
});

router.get('/preprocess/download/:session_id', (req: Request, res: Response): void => {
  const session_id = req.params['session_id'] as string;
  if (!sessions.has(session_id)) {
    res.status(404).json({ detail: 'Session not found' });
    return;
  }
  const session = sessions.get(session_id)!;
  const tables = session.tables ?? {};
  const firstRows = Object.values(tables)[0]?.rows ?? session.dfPreprocessed;
  if (!firstRows) {
    res.status(404).json({ detail: 'Data not found' });
    return;
  }
  const csv = rowsToCsvBytes(firstRows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=cleaned_data.csv');
  res.send(csv);
});

export default router;
