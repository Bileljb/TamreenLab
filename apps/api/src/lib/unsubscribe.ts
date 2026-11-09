import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The token in an email's unsubscribe link: an HMAC of the user id, so the link works without
 * signing in and cannot be made for someone else (ADR 011). The purpose prefix keeps it from ever
 * matching another use of the same secret.
 */
export function unsubscribeToken(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(`unsubscribe:${userId}`).digest('base64url');
}

export function verifyUnsubscribeToken(userId: string, token: string, secret: string): boolean {
  const expected = Buffer.from(unsubscribeToken(userId, secret));
  const given = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
