import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

const ISSUER = 'tamreen-api';

export function accessKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(userId: string, key: Uint8Array, now = new Date()) {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt(iat)
    .setExpirationTime(iat + ACCESS_TTL_SECONDS)
    .sign(key);
}

/** The user id in a valid access token, or null for a missing, expired or forged one. */
export async function verifyAccessToken(
  token: string | undefined,
  key: Uint8Array,
  now = new Date(),
) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: ISSUER,
      algorithms: ['HS256'],
      currentDate: now,
    });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/** An opaque refresh token. Only its hash is stored. */
export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
