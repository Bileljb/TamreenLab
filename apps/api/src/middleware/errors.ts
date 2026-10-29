import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/errors';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json(err.toBody());
    return;
  }
  if (err instanceof ZodError) {
    const body = new HttpError(400, 'VALIDATION_ERROR', 'Invalid request', err.issues).toBody();
    res.status(400).json(body);
    return;
  }
  // express.json() parse failures carry a status and type.
  if (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    err.type === 'entity.parse.failed'
  ) {
    res.status(400).json(new HttpError(400, 'BAD_JSON', 'Malformed JSON body').toBody());
    return;
  }
  req.log.error({ err }, 'unhandled error');
  res.status(500).json(new HttpError(500, 'INTERNAL', 'Internal server error').toBody());
};
