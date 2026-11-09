import { useCallback, useState } from 'react';
import type { Platform } from '@tamreen/shared';

/** The learner's Windows/Mac choice, when they override the detected platform. */
export const PLATFORM_KEY = 'tamreen.platform.v1';

type NavigatorLike = {
  platform?: string;
  userAgent?: string;
  userAgentData?: { platform?: string };
};

/** Mac (and iPad/iPhone keyboards, which use ⌘ too) or Windows; Windows is the default. */
export function detectPlatform(nav: NavigatorLike | undefined = globalThis.navigator): Platform {
  const hint = nav?.userAgentData?.platform || nav?.platform || nav?.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(hint) ? 'mac' : 'win';
}

/** A touch screen with no mouse or trackpad: shortcut steps become multiple choice there. */
export function isTouchOnly(): boolean {
  const media = globalThis.matchMedia;
  if (typeof media !== 'function') return false;
  return media('(pointer: coarse)').matches && !media('(any-pointer: fine)').matches;
}

function storedPlatform(): Platform | null {
  try {
    const raw = globalThis.localStorage?.getItem(PLATFORM_KEY);
    return raw === 'win' || raw === 'mac' ? raw : null;
  } catch {
    return null;
  }
}

/** The platform shortcut steps teach, with a manual switch that is remembered on this device. */
export function usePlatform() {
  const [platform, setState] = useState<Platform>(() => storedPlatform() ?? detectPlatform());
  const [touch] = useState(isTouchOnly);
  const setPlatform = useCallback((next: Platform) => {
    setState(next);
    try {
      globalThis.localStorage?.setItem(PLATFORM_KEY, next);
    } catch {
      // Storage blocked: the switch still works for this page.
    }
  }, []);
  return { platform, setPlatform, touch };
}
