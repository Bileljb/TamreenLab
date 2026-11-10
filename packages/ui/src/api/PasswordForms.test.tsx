import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '../test/intl';
import { ForgotPasswordForm, ResetPasswordForm } from './PasswordForms';

function stubFetch(status: number, body: unknown = null) {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body)) });
      return status === 204
        ? new Response(null, { status })
        : Response.json(body ?? {}, { status });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('ForgotPasswordForm', () => {
  it('asks for the email and says a link is on its way, whatever the account', async () => {
    const calls = stubFetch(202, { sent: true });
    const user = userEvent.setup();
    renderWithIntl(<ForgotPasswordForm loginHref="/ar/login" />);
    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'huda@example.com');
    await user.click(screen.getByRole('button', { name: 'أرسل الرابط' }));
    expect(await screen.findByText(/إن كان لهذا البريد حساب/)).toBeTruthy();
    expect(calls[0]).toEqual({
      url: '/api/auth/password/forgot',
      body: { email: 'huda@example.com' },
    });
  });
});

describe('ResetPasswordForm', () => {
  it('takes the token out of the address bar, and sets the new password', async () => {
    window.history.replaceState(null, '', '/ar/reset-password?token=abcdefghijklmnopqrstuvwxyz');
    const calls = stubFetch(204);
    const user = userEvent.setup();
    renderWithIntl(<ResetPasswordForm loginHref="/ar/login" forgotHref="/ar/forgot-password" />);
    expect(window.location.search).toBe('');

    await user.type(screen.getByLabelText('كلمة المرور الجديدة'), 'a brand new secret');
    await user.type(screen.getByLabelText('أعد كتابة كلمة المرور'), 'a different secret');
    await user.click(screen.getByRole('button', { name: 'احفظ كلمة المرور' }));
    expect(screen.getByRole('alert').textContent).toContain('غير متطابقتين');
    expect(calls).toHaveLength(0);

    await user.clear(screen.getByLabelText('أعد كتابة كلمة المرور'));
    await user.type(screen.getByLabelText('أعد كتابة كلمة المرور'), 'a brand new secret');
    await user.click(screen.getByRole('button', { name: 'احفظ كلمة المرور' }));
    expect(await screen.findByText(/تغيّرت كلمة المرور/)).toBeTruthy();
    expect(calls[0]).toEqual({
      url: '/api/auth/password/reset',
      body: { token: 'abcdefghijklmnopqrstuvwxyz', password: 'a brand new secret' },
    });
  });

  it('explains an expired link and offers a new one', async () => {
    window.history.replaceState(null, '', '/ar/reset-password?token=abcdefghijklmnopqrstuvwxyz');
    stubFetch(400, { error: { code: 'INVALID_RESET_TOKEN' } });
    const user = userEvent.setup();
    renderWithIntl(<ResetPasswordForm loginHref="/ar/login" forgotHref="/ar/forgot-password" />);
    await user.type(screen.getByLabelText('كلمة المرور الجديدة'), 'a brand new secret');
    await user.type(screen.getByLabelText('أعد كتابة كلمة المرور'), 'a brand new secret');
    await user.click(screen.getByRole('button', { name: 'احفظ كلمة المرور' }));
    expect((await screen.findByRole('alert')).textContent).toContain('انتهت صلاحيته');
    expect(screen.getByRole('link', { name: 'اطلب رابطًا جديدًا' }).getAttribute('href')).toBe(
      '/ar/forgot-password',
    );
  });

  it('without a token, goes straight to asking for a new link', () => {
    window.history.replaceState(null, '', '/ar/reset-password');
    renderWithIntl(<ResetPasswordForm loginHref="/ar/login" forgotHref="/ar/forgot-password" />);
    expect(screen.queryByLabelText('كلمة المرور الجديدة')).toBeNull();
    expect(screen.getByRole('link', { name: 'اطلب رابطًا جديدًا' })).toBeTruthy();
  });
});
