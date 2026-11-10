# Operations runbook

How to run TamreenLab in production once it is hosted (ADR 013). Choosing hosts is the developer's decision (D3). This page covers what the code provides and what the host must do.

## Network layout and client IPs

- The browser only talks to the web server. The web server proxies `/api/*` to the API.
- **Keep the API private.** It listens on `127.0.0.1` by default. Set `HOST=0.0.0.0` only when the API runs on a private network or in a separate container that nothing public can reach.
- **Set `TRUST_PROXY_HOPS`** (required in production). It is the number of proxies in front of the web server that append the client address to `X-Forwarded-For`:
  - a load balancer or reverse proxy: `1`;
  - a CDN plus a load balancer: `2`.

  Next.js forwards the header without adding to it, so it is not counted. If this value is wrong, rate limits and quotas either apply to everyone together or can be bypassed.

- **`PUBLIC_SITE_URL`** must be the exact public origin (scheme and host). The API refuses state-changing requests from any other `Origin`.

## Backups

- **`pnpm db:backup`** writes `backups/tamreen-<UTC time>.dump`, a compressed custom-format `pg_dump`, plus a `.json` manifest of row counts and the latest migration.
  - Counts and dump come from the same database snapshot.
  - `BACKUP_DIR` changes the folder.
  - `pg_dump` must be on `PATH`, at the server's major version (17).
- **Schedule it daily** on the host and copy the files off the machine (object storage in another region). Keep, for example, 7 daily, 4 weekly and 3 monthly backups.
- **Managed Postgres:** if the host's managed Postgres already takes point-in-time backups, keep `db:backup` for the weekly drill anyway. It proves a dump can be restored independently of the host.

## Restore drill (monthly, and after any schema change)

**`pnpm db:restore-drill [file]`** checks a backup without touching the live database:

1. Restores the newest dump (or the given one) into a scratch database, `<db>_restore_drill`.
2. Compares every table's row count and the latest migration with the manifest.
3. Exits non-zero on any difference.
4. Drops the scratch database.

Demonstrated on 2026-11-10: 16 tables and 1,609 rows matched in 1.3 s, and a manifest altered by five rows made the drill fail.

## Real restore (incident)

1. Stop the API, so nothing writes during the restore.
2. Create an empty database and restore into it:

   ```sh
   pg_restore --no-owner --no-privileges --exit-on-error --dbname "$NEW_DATABASE_URL" backups/<file>.dump
   ```

3. Point `DATABASE_URL` at it and run `pnpm db:migrate` (`prisma migrate deploy`) if the code is newer than the backup.
4. Start the API. Check `GET /api/health`, then sign in with a test account.
5. Keep the old database until the restore is confirmed.

## Monitoring

- **Uptime:**
  - Check `GET https://<site>/api/health` every minute. It returns `{"status":"ok","db":"ok"}`, or 503 when the database is unreachable. It goes through the web server, so it checks both.
  - Also check `GET https://<site>/ar`.
- **Logs:** both apps log JSON lines to stdout.
  - The API redacts cookies, tokens and passwords.
  - Every API response carries `X-Request-Id`. A 500 body includes it, so a learner's report can be matched to its log line.
  - Browser errors arrive as `"msg":"browser error"` with a `clientError` field.
  - Keep logs for 30 days at most (the privacy policy promises only as long as needed).
- **Error tracking:** alert on log lines at level `error` (50) and above, and on bursts of `browser error`. A hosted service (Sentry or similar) can read the same events later; adding one is a host decision.
- **Health of the AI assistant:** `pnpm metrics:report` shows its outcomes, the p95 wait, the spend and the helpful votes.

## Load

- **`pnpm --filter @tamreen/api load:test`** seeds its own database (`<db>_load`) and measures `POST /attempts` and the daily leaderboard with 32 concurrent clients.
- **On a development laptop (2026-11-10):**

  | Endpoint                 | Throughput | p95    |
  | ------------------------ | ---------- | ------ |
  | `POST /attempts`         | 243 req/s  | 207 ms |
  | `GET /leaderboard/daily` | 610 req/s  | 75 ms  |

  There were no errors, and the leaderboard query is an index-only scan.

- **Re-run it** when the data grows by an order of magnitude or before a launch campaign.
