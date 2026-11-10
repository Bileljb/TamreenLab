// pnpm reminders:send — this week's reminder to every learner who opted in (ADR 011, ADR 014). Run it
// daily: each run stops at MAIL_DAILY_LIMIT, and each learner gets at most one per ISO week.
import path from 'node:path';
import { pino } from 'pino';
import { CONTENT_LOCALES, type ContentLocale, type EmailCopy } from '@tamreen/shared';
import { curriculumIn, loadCurriculum, loadEmailCopy } from '@tamreen/content';
import { configFromEnv } from '../src/config';
import { createContext } from '../src/context';
import { loadEnv } from '../src/lib/env';
import { createMailer } from '../src/lib/mailer';
import { createPrisma } from '../src/lib/prisma';
import { sendWeeklyReminders } from '../src/services/reminders';

const env = loadEnv();
const logger = pino({ level: env.LOG_LEVEL });
const contentDir = process.env.CONTENT_DIR ?? path.resolve(import.meta.dirname, '../../../content');
const db = createPrisma();
try {
  const curriculum = await loadCurriculum(contentDir);
  const copy = {} as Record<ContentLocale, EmailCopy>;
  const titles = new Map<string, string>();
  for (const locale of CONTENT_LOCALES) {
    copy[locale] = await loadEmailCopy(contentDir, locale);
    for (const lesson of curriculumIn(curriculum, locale).lessons) {
      titles.set(`${locale}:${lesson.slug}`, lesson.titleAr);
    }
  }
  const ctx = createContext(db, configFromEnv(env));
  const result = await sendWeeklyReminders(ctx, createMailer(env, logger), {
    copy,
    lessonTitle: (locale, slug) => titles.get(`${locale}:${slug}`),
  });
  logger.info(result, 'reminders:send done');
} finally {
  await db.$disconnect();
}
