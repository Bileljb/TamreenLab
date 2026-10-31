'use client';

import { useEffect, useSyncExternalStore } from 'react';

const KEY = 'tamreen.theme';
const CHANGE = 'tamreen:theme';
type Choice = 'system' | 'light' | 'dark';

/**
 * Runs in <head> before the page paints, so a dark theme never flashes light. It also marks the
 * page as scripted (`html.js`), which enables the scroll-reveal animation.
 */
export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem('${KEY}');var d=c==='dark'||(c!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}document.documentElement.classList.add('js')})()`;

function apply(choice: Choice) {
  const dark =
    choice === 'dark' ||
    (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function read(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const ICONS: Record<Choice, string> = {
  system: 'M4 5h16v11H4zM9 20h6M12 16v4',
  light:
    'M12 4V2M12 22v-2M4.9 4.9 3.5 3.5M20.5 20.5l-1.4-1.4M4 12H2M22 12h-2M4.9 19.1l-1.4 1.4M20.5 3.5l-1.4 1.4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  dark: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
};

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Cycles system → light → dark; the choice is a per-browser convenience in localStorage. */
export function ThemeToggle({ labels }: { labels: Record<Choice, string> }) {
  // The server renders "system"; the browser then shows the stored choice without a mismatch.
  const choice = useSyncExternalStore(subscribe, read, () => 'system' as Choice);

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const follow = () => read() === 'system' && apply('system');
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, []);

  function next() {
    const order: Choice[] = ['system', 'light', 'dark'];
    const value = order[(order.indexOf(choice) + 1) % order.length]!;
    try {
      if (value === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, value);
    } catch {
      // Storage blocked: the theme still changes for this page.
    }
    apply(value);
    window.dispatchEvent(new Event(CHANGE));
  }

  return (
    <button
      type="button"
      onClick={next}
      title={labels[choice]}
      aria-label={labels[choice]}
      data-theme-choice={choice}
      className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={ICONS[choice]} />
      </svg>
    </button>
  );
}
