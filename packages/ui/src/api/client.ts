'use client';

import type {
  AssistantHintRequest,
  AssistantHintResponse,
  AttemptResponse,
  Leaderboard,
  LessonProgressDto,
  LoginRequest,
  ProgressSyncResponse,
  RegisterRequest,
  ReviewQueue,
  SettingsUpdate,
  Stats,
  User,
  GuestProgress,
} from '@tamreen/shared';
import { pageLocale } from '../locale';

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
  register: (body: RegisterRequest) =>
    send<User>('/auth/register', post({ ...body, locale: pageLocale() })),
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
    mode?: 'lesson' | 'review';
  }) => call<AttemptResponse>('/attempts', post({ ...body, locale: pageLocale() })),
  syncProgress: (guestProgress: GuestProgress) =>
    call<ProgressSyncResponse>('/progress/sync', post({ guestProgress })),
  progress: () => call<LessonProgressDto[]>('/me/progress'),
  stats: () => call<Stats>('/me/stats'),
  settings: (update: SettingsUpdate) =>
    call<User>('/me/settings', {
      method: 'PATCH',
      body: JSON.stringify({ ...update, locale: pageLocale() }),
    }),
  review: () => call<ReviewQueue>('/me/review'),
  /** From the link in a reminder email; needs no session. */
  unsubscribe: (u: string, t: string) =>
    send<{ unsubscribed: true }>('/email/unsubscribe', post({ u, t })),
  /** An AI explanation of a wrong formula; guests may ask too (ADR 012). */
  assistantHint: (body: Omit<AssistantHintRequest, 'locale'>) =>
    call<AssistantHintResponse>('/assistant/hint', post({ ...body, locale: pageLocale() })),
  assistantFeedback: (id: string, helpful: boolean) =>
    call<void>(`/assistant/hints/${encodeURIComponent(id)}/feedback`, post({ helpful })),
  leaderboard: (limit = 10) => send<Leaderboard>(`/leaderboard/daily?limit=${limit}`),
};

/** Sends an error caught by an error boundary to the API logs (ADR 013); never throws. */
export function reportClientError(error: Error & { digest?: string }) {
  void send<void>(
    '/client-errors',
    post({
      message: error.message.slice(0, 500),
      stack: error.stack?.slice(0, 4000),
      digest: error.digest?.slice(0, 100),
      path: window.location.pathname.slice(0, 300),
    }),
  ).catch(() => undefined);
}

/** Fired after the server awards points, so panels can refresh. */
export const POINTS_EVENT = 'tamreen:points';
export const announcePoints = () => window.dispatchEvent(new Event(POINTS_EVENT));
