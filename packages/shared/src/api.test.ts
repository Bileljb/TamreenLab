import { describe, expect, it } from 'vitest';
import { LoginRequestSchema, ProgressSyncRequestSchema, RegisterRequestSchema } from './api';

describe('auth requests', () => {
  it('normalises email and display name', () => {
    const parsed = RegisterRequestSchema.parse({
      email: '  Huda@Example.COM ',
      password: 'long enough',
      displayName: '  هدى   علي ',
    });
    expect(parsed).toEqual({
      email: 'huda@example.com',
      password: 'long enough',
      displayName: 'هدى علي',
    });
  });

  it.each([
    ['short password', { email: 'a@b.co', password: 'short', displayName: 'هدى' }],
    ['bad email', { email: 'nope', password: 'long enough', displayName: 'هدى' }],
    ['one-letter name', { email: 'a@b.co', password: 'long enough', displayName: ' ه ' }],
    ['long name', { email: 'a@b.co', password: 'long enough', displayName: 'ا'.repeat(31) }],
    [
      'extra field',
      { email: 'a@b.co', password: 'long enough', displayName: 'هدى', role: 'ADMIN' },
    ],
  ])('rejects %s', (_name, body) => {
    expect(RegisterRequestSchema.safeParse(body).success).toBe(false);
  });

  it('accepts a login and a guest progress merge', () => {
    expect(LoginRequestSchema.safeParse({ email: 'A@b.co', password: 'x' }).success).toBe(true);
    expect(
      ProgressSyncRequestSchema.safeParse({
        guestProgress: { version: 1, lessons: { 'sum-basics': { stepsDone: ['a'], points: 10 } } },
      }).success,
    ).toBe(true);
  });
});
