// pnpm --filter @tamreen/api mail:test you@example.com — sends one test email with the settings in
// .env (ADR 014), to check the SMTP details, the sender address and the domain records.
import { loadEnv } from '../src/lib/env';
import { createLogger } from '../src/lib/logger';
import { createMailer } from '../src/lib/mailer';

const to = process.argv[2];
if (!to || !to.includes('@')) throw new Error('Usage: mail:test you@example.com');
const env = loadEnv();
if (env.MAIL_TRANSPORT !== 'smtp') {
  console.log('MAIL_TRANSPORT is "log": set it to "smtp" in apps/api/.env to send for real.');
}
await createMailer(env, createLogger('info')).send({
  to,
  from: env.MAIL_FROM,
  subject: 'TamreenLab test email / رسالة تجريبية',
  text: 'If you can read this, TamreenLab can send email.\n\nإذا وصلتك هذه الرسالة، فإرسال البريد يعمل.',
  html: '<p>If you can read this, TamreenLab can send email.</p><p dir="rtl">إذا وصلتك هذه الرسالة، فإرسال البريد يعمل.</p>',
  headers: {},
});
console.log(`sent to ${to} from ${env.MAIL_FROM} via ${env.MAIL_TRANSPORT}`);
