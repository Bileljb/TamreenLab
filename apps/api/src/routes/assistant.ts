import { Router } from 'express';
import { AssistantFeedbackRequestSchema, AssistantHintRequestSchema } from '@tamreen/shared';
import type { Ctx } from '../context';
import { explainFormula, recordHintFeedback } from '../services/assistant';

/** The AI formula assistant (ADR 012). Guests may use it too, within the per-IP quota. */
export function assistantRouter(ctx: Ctx) {
  const router = Router();

  router.post('/assistant/hint', async (req, res) => {
    const body = AssistantHintRequestSchema.parse(req.body);
    const result = await explainFormula(
      ctx,
      body,
      { userId: req.userId, ip: req.ip ?? '' },
      (error) => req.log.warn({ err: error }, 'assistant model call failed'),
    );
    res.json(result);
  });

  router.post('/assistant/hints/:id/feedback', async (req, res) => {
    const { helpful } = AssistantFeedbackRequestSchema.parse(req.body);
    await recordHintFeedback(ctx, String(req.params.id), helpful, {
      userId: req.userId,
      ip: req.ip ?? '',
    });
    res.status(204).end();
  });

  return router;
}
