/**
 * POST /api/chat — Main chat endpoint. Mirrors Python backend/app/routes/chat.py.
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { sessions } from '../sessions';
import { processQuestion } from '../agents/orchestrator';

const router = Router();

router.post('/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { session_id, question, options = {}, mode = 'auto', web_search = false } = req.body;

    if (!session_id || !sessions.has(session_id)) {
      res.status(404).json({ detail: 'Session not found. Please upload a file first.' });
      return;
    }

    const session = sessions.get(session_id)!;
    const mergedOptions = { ...options, mode, web_search };

    const cacheStr = (question as string).toLowerCase().trim() + JSON.stringify(mergedOptions, Object.keys(mergedOptions).sort());
    const cacheKey = crypto.createHash('md5').update(cacheStr).digest('hex');
    const cache = (session.cache = session.cache ?? {});

    if (cache[cacheKey]) {
      return void res.json({ ...cache[cacheKey], from_cache: true });
    }

    const result = await processQuestion(question, session, mergedOptions);
    const timestamp = new Date().toISOString();
    const finalResult = { ...result, timestamp, from_cache: false };

    if (Object.keys(cache).length < 20) {
      cache[cacheKey] = finalResult;
    }

    const messages = (session.messages = session.messages ?? []);
    messages.push({ role: 'user', content: question, timestamp });
    messages.push({ role: 'assistant', ...finalResult });
    res.json(finalResult);
  } catch (e: any) {
    res.status(500).json({ detail: `Error processing question: ${e.message}` });
  }
});

export default router;
