import { ImageResponse } from 'next/og';
import { SITE_NAME } from './seo';

export const OG_SIZE = { width: 1200, height: 630 };

/**
 * Share images. The image renderer does not shape Arabic script, so the image shows a grid motif
 * and a formula (Latin text); the Arabic title travels in og:title next to it.
 */
export function ogImage(formula: string, label: string) {
  const cols = ['A', 'B', 'C', 'D'];
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 64,
        background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
        color: 'white',
      }}
    >
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, letterSpacing: 1 }}>
        {SITE_NAME}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {cols.map((c) => (
            <div
              key={c}
              style={{
                display: 'flex',
                width: 120,
                height: 56,
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.12)',
                borderRadius: 8,
                fontSize: 28,
              }}
            >
              {c}
            </div>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            background: 'white',
            color: '#064e3b',
            borderRadius: 16,
            padding: '24px 32px',
            fontSize: 56,
            fontFamily: 'monospace',
          }}
        >
          {formula}
        </div>
      </div>
      <div style={{ display: 'flex', fontSize: 32, opacity: 0.85 }}>{label}</div>
    </div>,
    OG_SIZE,
  );
}

/** The card for a shared lesson result: stars only, no name or points (Phase 7, ADR 011). */
export function shareImage(stars: number) {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 64,
        background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
        color: 'white',
      }}
    >
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, letterSpacing: 1 }}>
        {SITE_NAME}
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        {[1, 2, 3].map((n) => (
          <svg key={n} width="150" height="150" viewBox="0 0 24 24">
            <path
              d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"
              fill={n <= stars ? '#fbbf24' : 'rgba(255,255,255,0.25)'}
            />
          </svg>
        ))}
      </div>
      <div style={{ display: 'flex', fontSize: 44, fontWeight: 700 }}>
        {`Lesson complete · ${stars}/3`}
      </div>
    </div>,
    OG_SIZE,
  );
}
