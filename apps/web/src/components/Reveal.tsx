'use client';

import { useEffect } from 'react';

/**
 * Fades `[data-reveal]` elements in as they scroll into view. Content is visible without
 * JavaScript and with reduced motion (see globals.css); this only adds the entrance.
 */
export function Reveal() {
  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>('[data-reveal]:not([data-shown])');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.setAttribute('data-shown', ''));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.style.transitionDelay = `${Number(el.dataset.reveal || 0) * 80}ms`;
          el.setAttribute('data-shown', '');
          observer.unobserve(el);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return null;
}
