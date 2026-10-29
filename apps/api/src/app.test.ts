import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import { z } from 'zod';
import { createApp } from './app';
import { errorHandler } from './middleware/errors';

const logger = pino({ level: 'silent' });
const okDb = async () => {};
const ErrorShape = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});

describe('GET /api/health', () => {
  it('reports ok when the database answers', async () => {
    const res = await request(createApp({ logger, checkDb: okDb })).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
  });

  it('reports degraded with 503 when the database is down', async () => {
    const app = createApp({
      logger,
      checkDb: async () => {
        throw new Error('connection refused');
      },
    });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', db: 'down' });
  });

  it('sets security headers', async () => {
    const res = await request(createApp({ logger, checkDb: okDb })).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('error shape', () => {
  it('returns NOT_FOUND for unknown routes', async () => {
    const res = await request(createApp({ logger, checkDb: okDb })).get('/api/nope');
    expect(res.status).toBe(404);
    expect(ErrorShape.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('returns BAD_JSON for a malformed body', async () => {
    const res = await request(createApp({ logger, checkDb: okDb }))
      .post('/api/health')
      .set('content-type', 'application/json')
      .send('{"broken"');
    expect(res.status).toBe(400);
    expect(ErrorShape.parse(res.body).error.code).toBe('BAD_JSON');
  });

  it('maps zod errors to VALIDATION_ERROR and hides unknown errors as INTERNAL', async () => {
    const app = express();
    app.use(pinoHttp({ logger }));
    app.get('/zod', () => {
      z.object({ a: z.string() }).parse({});
    });
    app.get('/boom', () => {
      throw new Error('secret detail');
    });
    app.use(errorHandler);

    const zodRes = await request(app).get('/zod');
    expect(zodRes.status).toBe(400);
    expect(ErrorShape.parse(zodRes.body).error.code).toBe('VALIDATION_ERROR');

    const boomRes = await request(app).get('/boom');
    expect(boomRes.status).toBe(500);
    expect(boomRes.body).toEqual({ error: { code: 'INTERNAL', message: 'Internal server error' } });
  });
});
