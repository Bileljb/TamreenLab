import { ImageResponse } from 'next/og';

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
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, letterSpacing: 2 }}>
        TAMREEN
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
