import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type { Logger } from 'pino';
import type { Env } from './env';

export type Email = {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
};

/**
 * Sends email (ADR 011, ADR 014). `log` records each email in the logs and sends nothing; `smtp`
 * sends through any SMTP provider (Brevo for now), so changing provider is a settings change.
 */
export interface Mailer {
  send(email: Email): Promise<void>;
}

/** Logs instead of sending, and keeps the last emails it "sent" so tests can read them. */
export class LogMailer implements Mailer {
  readonly sent: Email[] = [];
  constructor(private readonly logger?: Logger) {}

  async send(email: Email) {
    this.sent.push(email);
    // The API process runs for weeks: keep a bounded window, not every email.
    if (this.sent.length > 50) this.sent.shift();
    this.logger?.info({ to: email.to, subject: email.subject }, 'email (log transport, not sent)');
  }
}

/** Sends through SMTP. Port 465 uses TLS from the start; other ports must upgrade with STARTTLS. */
export class SmtpMailer implements Mailer {
  private readonly transport;

  constructor(
    options: SMTPTransport.Options | { jsonTransport: true },
    private readonly logger?: Logger,
  ) {
    this.transport = nodemailer.createTransport(options);
  }

  /** Sends and returns the transport's receipt (tests read the message from it). */
  async deliver(email: Email) {
    return this.transport.sendMail({
      from: email.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      headers: email.headers,
    });
  }

  async send(email: Email) {
    const info = await this.deliver(email);
    this.logger?.info({ to: email.to, subject: email.subject, id: info.messageId }, 'email sent');
  }
}

type MailEnv = Pick<Env, 'MAIL_TRANSPORT'> &
  Partial<Pick<Env, 'SMTP_HOST' | 'SMTP_PORT' | 'SMTP_USER' | 'SMTP_PASS'>>;

/** The mailer the settings ask for; the env schema has already required the SMTP details. */
export function createMailer(env: MailEnv, logger?: Logger): Mailer {
  if (env.MAIL_TRANSPORT !== 'smtp') return new LogMailer(logger);
  const port = env.SMTP_PORT ?? 587;
  return new SmtpMailer(
    {
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: env.SMTP_USER!, pass: env.SMTP_PASS! },
      // A slow provider must not hold a request (password reset) for long.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    },
    logger,
  );
}
