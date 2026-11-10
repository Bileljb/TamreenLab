import { describe, expect, it } from 'vitest';
import { createMailer, LogMailer, SmtpMailer, type Email } from './mailer';

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
