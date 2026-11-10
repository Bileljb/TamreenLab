import { describe, expect, it } from 'vitest';
import { BrevoApiMailer, createMailer, LogMailer, SmtpMailer, type Email } from './mailer';

const email: Email = {
  to: 'huda@example.com',
  from: 'TamreenLab <noreply@tamreen.test>',
  subject: 'مرحبًا',
  text: 'نص',
  html: '<p dir="rtl">نص</p>',
  headers: { 'List-Unsubscribe': '<https://tamreen.test/u>' },
};

describe('createMailer', () => {
  it('logs unless SMTP is configured', () => {
    expect(createMailer({ MAIL_TRANSPORT: 'log' })).toBeInstanceOf(LogMailer);
    expect(
      createMailer({
        MAIL_TRANSPORT: 'smtp',
        SMTP_HOST: 'smtp-relay.brevo.com',
        SMTP_PORT: 587,
        SMTP_USER: 'u',
        SMTP_PASS: 'p',
      }),
    ).toBeInstanceOf(SmtpMailer);
  });
});

describe('SmtpMailer', () => {
  it('hands the whole message, headers included, to the transport', async () => {
    const mailer = new SmtpMailer({ jsonTransport: true });
    const sent = await mailer.deliver(email);
    const message = JSON.parse(sent.message as string);
    expect(message).toMatchObject({
      subject: 'مرحبًا',
      text: 'نص',
      html: '<p dir="rtl">نص</p>',
      headers: { 'List-Unsubscribe': '<https://tamreen.test/u>' },
    });
    expect(message.to[0].address).toBe('huda@example.com');
    expect(message.from.address).toBe('noreply@tamreen.test');
  });
});

describe('BrevoApiMailer', () => {
  it('posts the message to the Brevo API over HTTPS, headers included', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchStub = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      return Response.json({ messageId: '<abc@smtp-relay.mailin.fr>' }, { status: 201 });
    };
    const mailer = new BrevoApiMailer('xkeysib-test', undefined, fetchStub as typeof fetch);
    await mailer.send(email);
    expect(calls[0]!.url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((calls[0]!.init.headers as Record<string, string>)['api-key']).toBe('xkeysib-test');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      sender: { name: 'TamreenLab', email: 'noreply@tamreen.test' },
      to: [{ email: 'huda@example.com' }],
      subject: 'مرحبًا',
      textContent: 'نص',
      htmlContent: '<p dir="rtl">نص</p>',
      headers: { 'List-Unsubscribe': '<https://tamreen.test/u>' },
    });
  });

  it('fails loudly when Brevo refuses, so the caller can retry', async () => {
    const refuse = async () => Response.json({ code: 'unauthorized' }, { status: 401 });
    const mailer = new BrevoApiMailer('bad', undefined, refuse as typeof fetch);
    await expect(mailer.send(email)).rejects.toThrow(/401/);
  });

  it('is chosen with MAIL_TRANSPORT=brevo', () => {
    expect(createMailer({ MAIL_TRANSPORT: 'brevo', BREVO_API_KEY: 'k' })).toBeInstanceOf(
      BrevoApiMailer,
    );
  });
});
