'use client';

import type {
  AttemptResponse,
  Leaderboard,
  LessonProgressDto,
  LoginRequest,
  ProgressSyncResponse,
  RegisterRequest,
  Stats,
  User,
  GuestProgress,
} from '@tamreen/shared';

/** An API error with the server's code (`EMAIL_TAKEN`, `INVALID_CREDENTIALS`, ...), or NETWORK. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

async function send<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...init,
      headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError(0, 'NETWORK');
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
  if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? 'HTTP_ERROR');
  return body as T;
}

let refreshing: Promise<boolean> | null = null;

/** Set by the API next to the httpOnly session cookies; absent for guests. */
const hasSessionHint = () =>
  typeof document !== 'undefined' && /(?:^|;\s*)tamreen_session=1/.test(document.cookie);

/** Refreshes the session once, shared by concurrent callers. Guests skip it entirely. */
function refresh(): Promise<boolean> {
  if (!hasSessionHint()) return Promise.resolve(false);
  refreshing ??= send<User>('/auth/refresh', { method: 'POST', body: '{}' })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Calls the API; on 401 it refreshes the 15-minute access token once and retries. */
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    return await send<T>(path, init);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && (await refresh())) return send<T>(path, init);
    throw e;
  }
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const api = {
  me: () => call<User>('/me'),
  register: (body: RegisterRequest) => send<User>('/auth/register', post(body)),
  login: (body: LoginRequest) => send<User>('/auth/login', post(body)),
  logout: () => send<void>('/auth/logout', post({})),
  deleteAccount: () => call<void>('/me', { method: 'DELETE' }),
  attempt: (body: {
    lessonSlug: string;
    stepSlug: string;
    answer: unknown;
    timeMs: number;
    hintUsed: boolean;
    answerShown: boolean;
  }) => call<AttemptResponse>('/attempts', post(body)),
  syncProgress: (guestProgress: GuestProgress) =>
    call<ProgressSyncResponse>('/progress/sync', post({ guestProgress })),
  progress: () => call<LessonProgressDto[]>('/me/progress'),
  stats: () => call<Stats>('/me/stats'),
  leaderboard: (limit = 10) => send<Leaderboard>(`/leaderboard/daily?limit=${limit}`),
};

/** Fired after the server awards points, so panels can refresh. */
export const POINTS_EVENT = 'tamreen:points';
export const announcePoints = () => window.dispatchEvent(new Event(POINTS_EVENT));
