import { Router } from 'express';

export type DbCheck = () => Promise<void>;

export function healthRouter(checkDb: DbCheck) {
  const router = Router();

  router.get('/health', async (req, res) => {
    let db: 'ok' | 'down' = 'ok';
    try {
      await checkDb();
    } catch (err) {
      req.log.warn({ err }, 'database health check failed');
      db = 'down';
    }
    res.status(db === 'ok' ? 200 : 503).json({ status: db === 'ok' ? 'ok' : 'degraded', db });
  });

  return router;
}
