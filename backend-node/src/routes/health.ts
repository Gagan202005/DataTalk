import { Router } from 'express';
import { sessions } from '../sessions';


const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    sessions: sessions.size,
  });
});

export default router;
