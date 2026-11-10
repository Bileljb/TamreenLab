# ADR 015 — Hosting for the test phase: Vercel, Render, Neon (D3)

- **Status:** accepted for the test phase
- **Date:** 2026-11-10
- **Decider:** the developer (D3) wants free hosting that is easy to deploy for a first test with users, and accepts a slow first visit. Claude Code chose the services and the integration.

## Context

The architecture assumed one machine: the API listens on localhost behind the Next.js web server (ADR 013). Free hosts split the parts across services instead:

- **Render's free web services** sleep when idle, and since September 2025 they block outbound SMTP ports.
- **Vercel's free (Hobby) plan** is for non-commercial use only.
- **Neon's free plan** gives 1 GB of Postgres and 100 compute-hours a month.
- **GitHub Pages** only serves static files.
- **Cloudflare Workers** cannot run the Express API unchanged: argon2 is native code, and the mailer and Prisma setup assume Node.

## Decision

**Where each part runs:**

- **Website on Vercel** (`apps/web` as the root directory).
- **API on Render**, from `render.yaml`:
  - region Frankfurt;
  - it deploys only after CI passes;
  - the build applies migrations and syncs content.
- **Database on Neon**, also in Frankfurt.
- **Reminders** run in a daily GitHub Actions job (`.github/workflows/reminders.yml`), which does nothing until its secrets exist.

**The API has a public address now, so it only serves the website:**

- With `PROXY_SECRET` set, the website's proxy (`apps/web/src/proxy.ts`) forwards `/api/*` to `API_URL` with two headers: `x-tamreen-proxy` (the secret) and `x-tamreen-client-ip`.
- The client IP comes from the host's own header (`x-real-ip` on Vercel, `cf-connecting-ip` on Cloudflare), which visitors cannot set.
- The API refuses any request without the secret (`403 NOT_VIA_SITE`), using a timing-safe comparison. It then uses the forwarded IP for rate limits and quotas.
- The host's health check is exempt from the secret.
- In production, `PROXY_SECRET` replaces `TRUST_PROXY_HOPS`. Without it (local development, or one machine), nothing changes.

**Email.** `MAIL_TRANSPORT=brevo` sends through Brevo's HTTPS API (port 443) with `BREVO_API_KEY`, because Render's free plan blocks SMTP. SMTP stays available for hosts that allow it.

## Consequences

- **Cold starts.** The first request after 15 idle minutes waits for Render to wake (about a minute). Accepted for the test.
- **Ads.** Ads (D5) need a host that allows commercial use: Vercel Pro, Cloudflare, or a VPS (the plan from ADR 013).
- **Tests:**
  - Integration: requests without the secret are refused; the health check still answers; per-visitor limits use the forwarded IP.
  - Unit: the Brevo API mailer, and the header handling of the website's proxy.
  - Locally, the account and engagement e2e tests passed through the proxy with the secret set on both servers.
- **Steps:** `docs/DEPLOY.md` has the step-by-step setup and the upgrade path.
