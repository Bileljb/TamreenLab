'use client';

import { useEffect, useRef } from 'react';

const COLOURS = ['#10b981', '#14b8a6', '#0ea5e9', '#a78bfa', '#f59e0b', '#f43f5e'];

/**
 * A short burst of confetti over its parent when a lesson is completed. Pure canvas, about
 * 1.8 seconds, skipped entirely when the learner prefers reduced motion.
 */
export function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || typeof matchMedia !== 'function') return; // tests and very old browsers
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const scale = window.devicePixelRatio || 1;
    const { width, height } = el.getBoundingClientRect();
    el.width = width * scale;
    el.height = height * scale;
    ctx.scale(scale, scale);

    const pieces = Array.from({ length: 90 }, () => ({
      x: width / 2 + (Math.random() - 0.5) * width * 0.3,
      y: height * 0.35,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 9 - 4,
      size: 5 + Math.random() * 5,
      spin: Math.random() * Math.PI,
      turn: (Math.random() - 0.5) * 0.3,
      colour: COLOURS[Math.floor(Math.random() * COLOURS.length)]!,
    }));

    let frame = 0;
    let raf = 0;
    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);
      for (const p of pieces) {
        p.vy += 0.28;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.spin += p.turn;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - frame / 110);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.fillStyle = p.colour;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (frame < 110) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 size-full" />;
}
