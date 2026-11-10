# Deploying the free test version

A free setup for testing with real people (ADR 015). It takes about 30 minutes, and every part has a paid plan to move to later.

| Part            | Service               | Free plan                                                                     |
| --------------- | --------------------- | ----------------------------------------------------------------------------- |
| Website         | **Vercel**            | Non-commercial use only: fine for a test without ads                          |
| API             | **Render**            | Sleeps after 15 minutes idle; the first visit after that waits about a minute |
| Database        | **Neon** (Postgres)   | 1 GB storage; 100 compute-hours a month; sleeps when idle                     |
| Email           | **Brevo** (HTTPS API) | 300 emails a day                                                              |
| Daily reminders | **GitHub Actions**    | `.github/workflows/reminders.yml`                                             |

Sign up for each service with your GitHub account; it is quicker.

## 0. Make two secrets

On your computer, in the project folder, run this twice and keep both values somewhere safe:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- The first is **`JWT_SECRET`**. It signs sessions and unsubscribe links. It goes in Render and in GitHub.
- The second is **`PROXY_SECRET`**. Only the website knows it, so the API can refuse anyone else. It goes in Render and in Vercel.

Never commit either of them.

## 1. Database: Neon

1. At neon.tech, create a project named `tamreenlab`. Pick the region **AWS Europe (Frankfurt)**, close to the API.
2. Open **Connect** and copy the connection string. Turn **connection pooling off**: migrations need a direct connection. It looks like this:

   ```
   postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

This is your **`DATABASE_URL`**.

## 2. Email: a Brevo API key

1. In Brevo, open **SMTP et API → Clés API et MCP** and generate an API key. This is **`BREVO_API_KEY`**. It is not the SMTP key: Render's free plan blocks SMTP, so the API sends through Brevo's HTTPS API.
2. **`MAIL_FROM`** is the sender you verified in Brevo, for example `TamreenLab <oneplacedb@gmail.com>`.

## 3. API: Render

1. Choose Render → **New → Blueprint**, and pick the GitHub repository. Render reads `render.yaml`.
2. Fill in the values it asks for:

   | Setting           | Value                                                          |
   | ----------------- | -------------------------------------------------------------- |
   | `DATABASE_URL`    | from step 1                                                    |
   | `JWT_SECRET`      | from step 0                                                    |
   | `PROXY_SECRET`    | from step 0                                                    |
   | `PUBLIC_SITE_URL` | `https://placeholder.example` for now; step 5 replaces it      |
   | `BREVO_API_KEY`   | from step 2                                                    |
   | `MAIL_FROM`       | from step 2                                                    |
   | `GROQ_API_KEY`    | your Groq key, or leave it empty to show only the static hints |

3. Deploy.
   - The build installs everything, builds the API, applies the database migrations and loads the lessons (`content:sync`). The first build takes a few minutes.
   - Render deploys `main` only after CI passes.
4. When it is live, open `https://<your-service>.onrender.com/api/health`. It should show `{"status":"ok","db":"ok"}`.
5. Any other address on the API answers `403 NOT_VIA_SITE`. That is expected: only the website may call it.

## 4. Website: Vercel

1. Choose Vercel → **Add New → Project** and import the repository.
2. Set **Root Directory** to `apps/web`. Vercel detects Next.js and pnpm, and the default build command is right.
3. Add these environment variables:

   | Variable          | Value                                 |
   | ----------------- | ------------------------------------- |
   | `API_URL`         | `https://<your-service>.onrender.com` |
   | `PROXY_SECRET`    | the same value as on Render           |
   | `NEXT_PUBLIC_ADS` | `off`                                 |
   | `SITE_URL`        | leave it out for now; step 5 sets it  |

4. Deploy. Vercel gives an address such as `https://tamreenlab.vercel.app`.

## 5. Connect the two addresses

1. In **Vercel**, add `SITE_URL=https://<your-site>.vercel.app` (no trailing slash) and redeploy. Canonical links, the sitemap and share pages use it.
2. In **Render**, set `PUBLIC_SITE_URL` to the same address. The API refuses form posts from any other origin, and links in emails use it. Render redeploys on its own.

## 6. Daily reminders: GitHub

In the GitHub repository, open **Settings → Secrets and variables → Actions** and add these repository secrets:

- `DATABASE_URL`
- `JWT_SECRET` (the same value as on Render)
- `PUBLIC_SITE_URL`
- `BREVO_API_KEY`
- `MAIL_FROM`

Then go to **Actions → Daily reminders → Run workflow** once to check it. From then on it runs every day at 09:00 (UTC+3).

## 7. Check it works

The first visit can take about a minute while the API wakes.

- [ ] The home page loads in Arabic, English and French.
- [ ] A lesson step can be answered as a guest.
- [ ] Sign up, finish a step, and see the points on the leaderboard.
- [ ] A wrong formula, then "Explain my mistake", shows an AI explanation (if `GROQ_API_KEY` is set).
- [ ] "Forgot password" with your own email sends a reset link (check spam too) that works.
- [ ] `https://<your-service>.onrender.com/api/leaderboard/daily` answers 403 when opened directly.

## Limits of the free setup, and what to upgrade

- **Waking up.** After 15 minutes without visitors the API sleeps, and the next visit waits about a minute. If that visit fails, a reload works. Render's cheapest paid instance removes this.
- **Ads.** Vercel's free plan is for non-commercial use. Before turning ads on (D5), move to Vercel Pro or another web host, such as Cloudflare or a VPS.
- **Backups.** Neon keeps a short restore history on the free plan. `pnpm db:backup` and the restore drill (docs/OPERATIONS.md) work against Neon from your computer, given `pg_dump` 17 and `DATABASE_URL`. Run them before risky changes.
- **Email.** It is sent from a Gmail address until you verify a domain in Brevo (ADR 014).
- **Address.** A `*.vercel.app` address is fine for testing. A domain of your own can be added in Vercel later; then update `SITE_URL`, `PUBLIC_SITE_URL` and the GitHub secret.
