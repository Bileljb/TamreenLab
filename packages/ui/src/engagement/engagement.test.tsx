import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { LessonFileSchema, type LessonFileInput, type Stats, type User } from '@tamreen/shared';
import { renderWithIntl } from '../test/intl';
import { AuthForm } from '../api/AuthForm';
import { SessionProvider } from '../api/session';
import { AccountSettings } from './AccountSettings';
import { ReviewSession } from './ReviewSession';
import { WelcomeBack } from './WelcomeBack';
import { UnsubscribeConfirm } from './Unsubscribe';

const USER: User = {
  id: 'u1',
  email: 'huda@example.com',
  displayName: 'هدى',
  createdAt: '2026-11-01T00:00:00.000Z',
  settings: { dailyGoal: 900, streakFreeze: false, emailOptIn: false },
};

type Call = { method: string; url: string; body: unknown };

/** A fake API: answers by "METHOD /path", records every call, and fails anything unknown. */
function fakeApi(routes: Record<string, (body: unknown) => unknown>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      const route = routes[`${method} ${url.split('?')[0]}`];
      if (!route) return Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
      const result = route(body);
      return result === undefined ? new Response(null, { status: 204 }) : Response.json(result);
    }),
  );
  return calls;
}

const withSession = (ui: ReactElement) => renderWithIntl(<SessionProvider>{ui}</SessionProvider>);

afterEach(() => vi.unstubAllGlobals());

describe('AccountSettings', () => {
  it('saves each change at once and shows the result', async () => {
    let settings = USER.settings;
    const calls = fakeApi({
      'GET /api/me': () => ({ ...USER, settings }),
      'PATCH /api/me/settings': (body) => {
        settings = { ...settings, ...(body as object) };
        return { ...USER, settings };
      },
    });
    const user = userEvent.setup();
    withSession(<AccountSettings loginHref="/ar/login" />);

    const email = await screen.findByTestId('setting-emailOptIn');
    expect(email.getAttribute('aria-checked')).toBe('false');
    await user.click(email);
    await waitFor(() => expect(email.getAttribute('aria-checked')).toBe('true'));
    expect(screen.getByRole('status').textContent).toBe('حُفظت الإعدادات.');
    await user.click(screen.getByRole('radio', { name: /مكثّف/ }));
    await waitFor(() => expect(settings.dailyGoal).toBe(1800));

    const patches = calls.filter((c) => c.method === 'PATCH').map((c) => c.body);
    expect(patches).toEqual([
      { emailOptIn: true, locale: 'ar' },
      { dailyGoal: 1800, locale: 'ar' },
    ]);
  });

  it('asks guests to sign in', async () => {
    fakeApi({});
    withSession(<AccountSettings loginHref="/ar/login?next=x" />);
    const link = await screen.findByRole('link', { name: 'سجّل الدخول' });
    expect(link.getAttribute('href')).toBe('/ar/login?next=x');
  });
});

describe('sign-up', () => {
  it('sends no email opt-in unless the box is ticked', async () => {
    const calls = fakeApi({ 'POST /api/auth/register': () => USER });
    vi.stubGlobal('location', { ...window.location, assign: vi.fn(), search: '' });
    const user = userEvent.setup();
    withSession(<AuthForm mode="signUp" fallbackNext="/ar" switchHref="/ar/login" />);
    const box = screen.getByRole('checkbox');
    expect((box as HTMLInputElement).checked).toBe(false);

    await user.type(screen.getByLabelText(/الاسم الظاهر/), 'هدى');
    await user.type(screen.getByRole('textbox', { name: 'البريد الإلكتروني' }), 'h@example.com');
    await user.type(screen.getByLabelText(/كلمة المرور/), 'correct horse');
    await user.click(screen.getByRole('button', { name: 'إنشاء الحساب' }));
    const register = () => calls.find((c) => c.url === '/api/auth/register');
    await waitFor(() => expect(register()).toBeTruthy());
    expect(register()!.body).toMatchObject({ emailOptIn: false, locale: 'ar' });
  });
});

describe('WelcomeBack', () => {
  const stats: Stats = {
    pointsToday: 450,
    pointsTotal: 2100,
    streak: { current: 4, longest: 6, frozen: true },
    lessonsCompleted: 2,
    firstTryAccuracy: 0.5,
    level: { level: 3, into: 600, span: 1500 },
    dailyGoal: 900,
    reviewsDue: 2,
    nextLesson: { slug: 'sum-basics', track: 'aggregation' },
  };

  it('shows level, goal, streak, reviews due and where to continue', async () => {
    fakeApi({ 'GET /api/me': () => USER, 'GET /api/me/stats': () => stats });
    withSession(<WelcomeBack locale="ar" lessonTitles={{ 'sum-basics': 'دالة الجمع' }} />);
    expect(await screen.findByText('أهلًا بعودتك يا هدى')).toBeTruthy();
    expect(screen.getByText('المستوى 3')).toBeTruthy();
    expect(screen.getByRole('img', { name: '450 من 900 نقطة اليوم' })).toBeTruthy();
    expect(screen.getByTestId('welcome-streak').textContent).toContain('4 أيام متتالية');
    expect(screen.getByText('يغطي تجميد السلسلة يوم أمس.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'تابع: دالة الجمع' }).getAttribute('href')).toBe(
      '/ar/lessons/aggregation/sum-basics',
    );
    expect(screen.getByRole('link', { name: 'راجع خطوتين أخطأت فيهما' }).getAttribute('href')).toBe(
      '/ar/review',
    );
  });

  it('shows nothing to guests', async () => {
    fakeApi({});
    const { container } = withSession(<WelcomeBack locale="ar" lessonTitles={{}} />);
    await waitFor(() => expect(container.textContent).toBe(''));
  });
});

describe('ReviewSession', () => {
  const lesson = LessonFileSchema.parse({
    slug: 'logic-lesson',
    track: 'logic',
    order: 3,
    kind: 'CONCEPT',
    titleAr: 'درس',
    summaryAr: 'ملخص',
    minutes: 3,
    steps: [
      {
        slug: 'which',
        type: 'MULTIPLE_CHOICE',
        promptAr: 'أي دالة تجمع؟',
        check: { options: ['COUNT', 'SUM'], correct: 1 },
      },
      {
        slug: 'other',
        type: 'MULTIPLE_CHOICE',
        promptAr: 'سؤال آخر',
        check: { options: ['A', 'B'], correct: 0 },
      },
    ],
  } satisfies LessonFileInput);

  const session = () =>
    withSession(
      <ReviewSession
        locale="ar"
        glossary={{}}
        lessonsHref="/ar/lessons"
        lessonsBase="/ar/lessons"
        loginHref="/ar/login"
      />,
    );

  it('plays the due steps and sends them as reviews of their own lesson', async () => {
    const calls = fakeApi({
      'GET /api/me': () => USER,
      'GET /api/me/review': () => ({
        items: [{ lessonSlug: 'logic-lesson', stepSlug: 'which', track: 'logic', box: 0 }],
      }),
      'GET /ar/lessons/logic/logic-lesson/data': () => lesson,
      'POST /api/attempts': () => ({
        correct: true,
        code: 'OK',
        pointsAwarded: 50,
        firstTry: false,
      }),
    });
    const user = userEvent.setup();
    session();
    // Only the due step, not the rest of its lesson.
    expect(await screen.findByText('الخطوة 1 من 1')).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'SUM' }));
    await user.click(screen.getByRole('button', { name: 'تحقّق' }));
    await waitFor(() => expect(calls.some((c) => c.url === '/api/attempts')).toBe(true));
    expect(calls.find((c) => c.url === '/api/attempts')!.body).toMatchObject({
      lessonSlug: 'logic-lesson',
      stepSlug: 'which',
      mode: 'review',
    });
    await user.click(screen.getByRole('button', { name: 'متابعة' }));
    expect(screen.getByRole('heading', { name: 'أحسنت! أنهيت المراجعة' })).toBeTruthy();
  });

  it('says so when nothing is due', async () => {
    fakeApi({ 'GET /api/me': () => USER, 'GET /api/me/review': () => ({ items: [] }) });
    session();
    expect((await screen.findByTestId('review-empty')).textContent).toContain('لا توجد أخطاء');
  });
});

describe('UnsubscribeConfirm', () => {
  it('sends the id and token from the link', async () => {
    window.history.replaceState(null, '', '/ar/unsubscribe?u=u1&t=tok');
    const calls = fakeApi({ 'POST /api/email/unsubscribe': () => ({ unsubscribed: true }) });
    renderWithIntl(<UnsubscribeConfirm homeHref="/ar" />);
    expect(await screen.findByText('ألغينا اشتراكك في التذكير الأسبوعي.')).toBeTruthy();
    expect(calls[0]!.body).toEqual({ u: 'u1', t: 'tok' });
  });

  it('reports a link without a token as invalid', async () => {
    window.history.replaceState(null, '', '/ar/unsubscribe');
    fakeApi({});
    renderWithIntl(<UnsubscribeConfirm homeHref="/ar" />);
    await waitFor(() =>
      expect(screen.getByTestId('unsubscribe-result').textContent).toContain('غير صالح'),
    );
  });
});
