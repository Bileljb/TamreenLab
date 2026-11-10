import { randomUUID } from 'node:crypto';
import { pino, type DestinationStream, type Level } from 'pino';

/** Paths that hold credentials; pino replaces their values before anything is written. */
const REDACT = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  '*.password',
  '*.token',
  '*.t',
];

/** Structured JSON logs (one line per event) with credentials removed (ADR 013). */
export function createLogger(level: Level | 'silent', destination?: DestinationStream) {
  return pino({ level, redact: { paths: REDACT, censor: '[redacted]' } }, destination);
}

/** The request id: the proxy's `X-Request-Id` when it looks like one, else a new UUID. */
export function requestId(incoming: string | string[] | undefined): string {
  const value = Array.isArray(incoming) ? incoming[0] : incoming;
  return value && /^[\w-]{1,64}$/.test(value) ? value : randomUUID();
}
