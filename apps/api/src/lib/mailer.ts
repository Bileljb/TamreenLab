import type { Logger } from 'pino';

export type Email = {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
};

/**
 * Sends email. The provider is the developer's decision (ADR 011): until one is chosen, the `log`
 * transport records each email in the logs and sends nothing. A provider is one more class here.
 */
export interface Mailer {
  send(email: Email): Promise<void>;
}

/** Logs instead of sending, and keeps what it "sent" so tests can read it. */
export class LogMailer implements Mailer {
  readonly sent: Email[] = [];
  constructor(private readonly logger?: Logger) {}

  async send(email: Email) {
    this.sent.push(email);
    this.logger?.info({ to: email.to, subject: email.subject }, 'email (log transport, not sent)');
  }
}
