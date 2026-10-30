'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  emptyGuestProgress,
  type LoginRequest,
  type RegisterRequest,
  type User,
} from '@tamreen/shared';
import { loadGuestProgress, saveGuestProgress } from '../player/guestProgress';
import { api } from './client';

export type Session =
  | { status: 'loading'; user: null }
  | { status: 'guest'; user: null }
  | { status: 'user'; user: User };

type SessionApi = Session & {
  login: (body: LoginRequest) => Promise<void>;
  register: (body: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionApi | null>(null);

/**
 * Who is playing. Guests are the default: if the API is down or there is no session, everything
 * still works from localStorage (Phase 2 behaviour).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'loading', user: null });

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((user) => !cancelled && setSession({ status: 'user', user }))
      .catch(() => !cancelled && setSession({ status: 'guest', user: null }));
    return () => {
      cancelled = true;
    };
  }, []);

  /** After sign-in: move guest progress into the account, then forget it locally. */
  const signedIn = useCallback(async (user: User) => {
    const guest = loadGuestProgress();
    if (Object.keys(guest.lessons).length > 0) {
      try {
        await api.syncProgress(guest);
        saveGuestProgress(emptyGuestProgress());
      } catch {
        // Keep it locally; the next sign-in merges it (the merge is idempotent).
      }
    }
    setSession({ status: 'user', user });
  }, []);

  const value = useMemo<SessionApi>(
    () => ({
      ...session,
      login: async (body) => signedIn(await api.login(body)),
      register: async (body) => signedIn(await api.register(body)),
      logout: async () => {
        await api.logout().catch(() => undefined);
        setSession({ status: 'guest', user: null });
      },
    }),
    [session, signedIn],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

const GUEST: SessionApi = {
  status: 'guest',
  user: null,
  login: async () => undefined,
  register: async () => undefined,
  logout: async () => undefined,
};

/** The session; outside a provider (tests, stories) everyone is a guest. */
export function useSession(): SessionApi {
  return useContext(SessionContext) ?? GUEST;
}
