import { Router } from 'express';
import { ClientErrorReportSchema } from '@tamreen/shared';

/**
 * Browser errors join the API's structured logs (ADR 013), so one log search covers both. Nothing
 * is stored in the database. An error-tracking service, once chosen, reads the same events.
 */
export function clientErrorsRouter() {
  const router = Router();
  router.post('/client-errors', (req, res) => {
    const report = ClientErrorReportSchema.parse(req.body);
    req.log.warn({ clientError: report, userId: req.userId }, 'browser error');
    res.status(204).end();
  });
  return router;
}
