'use client';

import { useEffect } from 'react';
import { reportClientError } from '@tamreen/ui';
import ar from '../../messages/ar.json';
import en from '../../messages/en.json';

/**
 * The layout itself failed, so there is no locale provider: the copy comes straight from the
 * message files, Arabic first and English below (ADR 013).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => reportClientError(error), [error]);
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{ fontFamily: 'system-ui, sans-serif', padding: '4rem 1rem', textAlign: 'center' }}
      >
        <h1>{ar.errors.title}</h1>
        <p>{ar.errors.body}</p>
        <p lang="en" dir="ltr">
          {en.errors.title} {en.errors.body}
        </p>
        <button type="button" onClick={reset}>
          {ar.errors.retry} / <span lang="en">{en.errors.retry}</span>
        </button>
      </body>
    </html>
  );
}
