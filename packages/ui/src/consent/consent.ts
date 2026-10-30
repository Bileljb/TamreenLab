'use client';

import { useEffect, useState } from 'react';

export const CONSENT_KEY = 'tamreen.consent.v1';
export const CONSENT_EVENT = 'tamreen:consent';

export type Consent = {
  /** Anonymous first-party usage statistics (on unless the learner opts out). */
  analytics: boolean;
  /** Personalised ads; off until the learner agrees. */
  personalisedAds: boolean;
  decidedAt: string;
};

export function readConsent(): Consent | null {
  try {
    const raw = globalThis.localStorage?.getItem(CONSENT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Consent>;
    if (typeof value.analytics !== 'boolean' || typeof value.personalisedAds !== 'boolean')
      return null;
    return value as Consent;
  } catch {
    return null;
  }
}

export function writeConsent(choice: Omit<Consent, 'decidedAt'>) {
  const value: Consent = { ...choice, decidedAt: new Date().toISOString() };
  try {
    globalThis.localStorage?.setItem(CONSENT_KEY, JSON.stringify(value));
  } catch {
    // Blocked storage: the choice holds for this page view only.
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
  return value;
}

/** Analytics runs unless the learner said no. */
export const analyticsAllowed = () => readConsent()?.analytics ?? true;

/** The stored choice; `undefined` before it is read on the client, `null` when undecided. */
export function useConsent(): Consent | null | undefined {
  const [consent, setConsent] = useState<Consent | null | undefined>(undefined);
  useEffect(() => {
    const update = () => setConsent(readConsent());
    update();
    window.addEventListener(CONSENT_EVENT, update);
    return () => window.removeEventListener(CONSENT_EVENT, update);
  }, []);
  return consent;
}
