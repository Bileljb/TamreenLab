'use client';

import type { AnalyticsEventName } from '@tamreen/shared';
import { analyticsAllowed } from '../consent/consent';
import { pageLocale } from '../locale';

const ANON_KEY = 'tamreen.aid';
const SESSION_KEY = 'tamreen.sid';

function randomId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  );
}

/** A random id kept in the given storage; a fresh one per call if storage is blocked. */
function storedId(storage: Storage | undefined, key: string): string {
  try {
    const existing = storage?.getItem(key);
    if (existing) return existing;
    const id = randomId();
    storage?.setItem(key, id);
    return id;
  } catch {
    return randomId();
  }
}

/**
 * Records an anonymous usage event (ADR 007): a random browser id and a per-tab session id, never
 * the account. Skipped when the learner opted out; failures are ignored, so it never blocks them.
 */
export function track(
  name: AnalyticsEventName,
  props: { lessonSlug?: string; stepSlug?: string } = {},
) {
  if (typeof window === 'undefined' || !analyticsAllowed()) return;
  const body = JSON.stringify({
    name,
    anonId: storedId(globalThis.localStorage, ANON_KEY),
    sessionId: storedId(globalThis.sessionStorage, SESSION_KEY),
    ...props,
    locale: pageLocale(),
  });
  try {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined);
  } catch {
    // No fetch (old browser or test environment): nothing to do.
  }
}
