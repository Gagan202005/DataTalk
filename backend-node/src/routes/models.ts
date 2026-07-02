/**
 * GET  /api/models/available
 * POST /api/models/run
 * Mirrors Python backend/app/routes/models.py.
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { sessions } from '../sessions';
import { getAvailableUseCases, autoMapColumns, runInferenceSidecar } from '../agents/modelAgent';

const router = Router();

router.get('/models/available', (_req: Request, res: Response): void => {
  res.json({ use_cases: getAvailableUseCases() });
});

router.post('/models/run', async (req: Request, res: Response): Promise<void> => {
  try {
    const { session_id, use_case, models_selected = [], column_mapping: userMapping = {} } = req.body;

    if (!session_id || !sessions.has(session_id)) {
      res.status(404).json({ detail: 'Session not found.' });
      return;
    }

    const session = sessions.get(session_id)!;
    const tables = session.tables ?? {};
    if (!Object.keys(tables).length) {
      res.status(400).json({ detail: 'No data loaded in session.' });
      return;
    }

    const firstMeta = Object.values(tables)[0];
    const schema = firstMeta.schema;
    const rows = firstMeta.rows;

    let columnMapping = userMapping;
    if (!Object.keys(columnMapping).length) {
      const useCases: any[] = getAvailableUseCases();
      const info = useCases.find((u) => u.id === use_case);
      if (info) columnMapping = autoMapColumns(schema, info.required_features);
    }

    const result = await runInferenceSidecar({
      use_case, models_selected, column_mapping: columnMapping, schema, rows, session_id,
    });

    if (result.error) {
      res.status(400).json({ detail: result.error });
      return;
    }

    result.run_id = uuidv4().slice(0, 8);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ detail: `Model inference failed: ${e.message}` });
  }
});

export default router;
