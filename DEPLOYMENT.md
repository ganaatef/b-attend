# B-Attend — Deployment Guide (Client Demo → Vercel + PostgreSQL)

> **Scope:** This guide prepares B-Attend for a **live hosted client demo** on Vercel with a
> PostgreSQL database. It is **not** a full production launch — no new product features are
> added here. For production hardening, see the "Security hardening" and "Not ready for
> production" sections at the bottom.

---

## 0. Critical rules for this deployment

- **Database MUST be PostgreSQL.** SQLite is no longer supported — the Prisma schema
  `datasource` provider is `postgresql` and cannot switch to SQLite at runtime.
- **Never run `prisma db push` in production.** Use migrations:
  `npx prisma migrate deploy`.
- **Never auto-seed production.** `prisma/seed.ts` refuses to run when
  `NODE_ENV=production` unless `DEMO_SEED_CONFIRM=true`.
- **No real secrets in the repo.** `.env`, `*.db`, `*.sqlite` are git-ignored. Use Vercel's
  encrypted Environment Variables for all secrets.

---

## 1. Create a PostgreSQL database

Choose one provider and create an empty Postgres database:

- **Neon** (recommended, free tier): https://neon.tech → New project → copy the
  `postgresql://...` connection string (use the **pooled** URL for `DATABASE_URL`).
- **Supabase**: https://supabase.com → Project → Settings → Database → Connection string.
  Use the **Transaction** (port 5432) string for `DIRECT_URL` and the pooler for `DATABASE_URL`.
- **Vercel Postgres / Prisma Postgres**: create a store in the Vercel dashboard and copy the
  connection string.

You will need **two** values:
- `DATABASE_URL` — used by the app at runtime (use the pooled/connection-pooler URL).
- `DIRECT_URL` — used by `prisma migrate deploy` / `prisma generate` (direct, non-pooled).
  For Neon/Supabase set both to the same base URL if unsure; Supabase requires the direct one
  for migrations.

---

## 2. Local prerequisites

- Node.js 20+ (Vercel uses 20/22).
- `npm` (the project moved off `bun`; `package-lock.json` is committed).
- A local PostgreSQL for dev (optional but recommended):
  ```bash
  docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine
  ```
- Copy env files:
  ```bash
  cp .env.example .env          # local dev
  # edit .env and set DATABASE_URL / DIRECT_URL to your Postgres instance
  ```

---

## 3. Run migrations (the safe way)

The repo ships a **clean initial migration** at
`prisma/migrations/20250715000000_init_production_postgres/migration.sql`
generated with `prisma migrate diff --from-empty --to-schema-datamodel`.
This is the baseline; `prisma migrate deploy` will apply it to a fresh database.

**Recommended first-deployment flow (run locally against the production DB):**

```bash
# 1. Point DATABASE_URL + DIRECT_URL at the PRODUCTION Postgres (temporarily)
export DATABASE_URL="postgresql://USER:PASS@HOST:5432/battend?sslmode=require"
export DIRECT_URL="postgresql://USER:PASS@HOST:5432/battend?sslmode=require"

# 2. Apply the schema
npx prisma migrate deploy

# 3. (Optional) Seed safe demo data — ONLY for the client demo database
export DEMO_SEED_CONFIRM=true
npm run db:seed:demo
unset DEMO_SEED_CONFIRM
```

> Do **not** run seeding automatically in CI/Vercel. Seed manually and only once.

---

## 4. Vercel deployment

### A. Import & framework settings
- Import the GitHub repo into Vercel.
- Framework preset: **Next.js** (auto-detected).
- **Install command:** `npm install`
- **Build command:** `npx prisma generate && npx prisma migrate deploy && npm run build`
  - This runs migrations during build. If your provider disallows migrations at build time
    (e.g. pooled connections), use the safer flow above (migrate locally) and set the Vercel
    build command to just `npm run build`.
- **Output:** Next.js default (the `output: "standalone"` in `next.config.ts` is ignored by
  Vercel and is harmless).

### B. Environment Variables (Project Settings → Environment Variables)
Add ALL of the following (mark them for Production / Preview as needed):

| Key | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | postgres connection string | pooled URL; **required** |
| `DIRECT_URL` | postgres direct string | required for migrations |
| `APP_URL` | `https://<your-app>.vercel.app` | set after first deploy, then redeploy |
| `NODE_ENV` | `production` | |
| `SESSION_SECRET` | 64-char hex | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SUPER_ADMIN_EMAIL` | `super@b-attend.app` | |
| `SUPER_ADMIN_PASSWORD` | strong password | change after demo |
| `AI_PROVIDER` | `mock` | no OpenAI key needed for demo |
| `OPENAI_API_KEY` | *(empty)* | only if using real AI |
| `AI_DAILY_COACH_ENABLED` | `true` | |
| `AI_EMPLOYEE_INSIGHTS_ENABLED` | `true` | |
| `AI_MANAGER_INSIGHTS_ENABLED` | `true` | |
| `MANUAL_ACTIVATION_MODE` | `true` | demo uses manual tenant activation |
| `PAYMENT_PROVIDER` | `manual` | no real payments |
| `EMAIL_FROM` | `no-reply@b-attend.app` | |
| `SMTP_HOST` | *(empty)* | outbound email disabled if blank |
| `SMTP_PORT` | `587` | |
| `SMTP_USER` | *(empty)* | |
| `SMTP_PASS` | *(empty)* | |
| `DEMO_SEED_CONFIRM` | `false` | set `true` only when manually seeding |

> Do **not** commit these. Vercel stores them encrypted.

### C. Deploy
Push to the connected branch → Vercel builds and deploys. After the first successful deploy,
set `APP_URL` to the live URL and redeploy once.

---

## 5. Seed the live demo (manual, one-time)

After the database is migrated and the app is deployed:

```bash
# Locally, with DATABASE_URL/DIRECT_URL pointing at the production Postgres:
export DEMO_SEED_CONFIRM=true
npm run db:seed:demo
```

The seed creates:
- Platform users: `super@`, `sales@`, `support@`, `billing@b-attend.app` (password `demo1234`)
- Plans (Trial/Starter/Growth/Pro/Enterprise) × features
- System settings (manual activation, mock AI)
- Demo tenant **"B-Attend Demo Restaurant Group"** (slug `b-attend-demo`, ACTIVE, Growth plan)
- Owner, HR Admin, 2 Branch Managers, Employee users (password `demo1234`)
- Branches, departments, shift policies, 15 employees, schedules, sample attendance,
  approvals, invoices, a support ticket

> The seed is **idempotent** (upsert / create-if-missing) and **never deletes data**. It
> still refuses to run in `production` unless `DEMO_SEED_CONFIRM=true`.

**Demo credentials (client demo only — change before real production):**
```
super@b-attend.app    / demo1234   (SUPER_ADMIN)
owner@b-attend.app    / demo1234   (COMPANY_OWNER)
hr@b-attend.app       / demo1234   (HR_ADMIN)
manager@b-attend.app  / demo1234   (BRANCH_MANAGER — New Cairo)
employee@b-attend.app / demo1234   (EMPLOYEE)
```

---

## 6. Verify the live URL (smoke test)

See **`LIVE_DEMO_CHECKLIST.md`** for the full step-by-step checklist (public pages, each role,
Excel exports, and security/access-control checks).

Quick sanity:
```bash
curl -s -o /dev/null -w "%{http_code}" https://<your-app>.vercel.app/        # 200
curl -s -o /dev/null -w "%{http_code}" https://<your-app>.vercel.app/login   # 200
curl -s https://<your-app>.vercel.app/api/public/plans | head -c 200         # JSON plans
```

---

## 7. Rollback / failure handling

If the deployment fails:
1. **Do NOT run a destructive seed.** Check Vercel build logs and the database connection first.
2. Vercel dashboard → **Deployments → previous → "Instant Rollback"** reverts the app instantly
   (database is untouched).
3. If a migration applied partially, inspect with `npx prisma migrate status` against the DB.
4. Fix the env var / connection issue, then redeploy.

---

## 8. Package scripts (deployment-safe, cross-platform)

```bash
npm run build            # next build + postbuild copy (cross-platform, node only)
npm run typecheck        # tsc --noEmit
npm run lint             # eslint .
npm run db:generate      # prisma generate (also runs as postinstall)
npm run db:migrate:deploy# prisma migrate deploy  (production migrations)
npm run db:seed:demo     # tsx prisma/seed.ts (guarded; demo only)
npm run db:push          # prisma db push (LOCAL DEV ONLY — never in production)
```

`postinstall` runs `prisma generate` automatically on Vercel.

---

## 9. Security checks completed for this demo

- [x] `SESSION_SECRET` required in production (strong 32+ byte hex; app warns if missing).
- [x] Cookies are `secure` in production (`NODE_ENV === "production"`), `httpOnly`, `sameSite: lax`.
- [x] No real secrets committed (`.env`, `*.db`, `*.sqlite` git-ignored; `.env.example` only).
- [x] No hardcoded `DATABASE_URL` (read from env only).
- [x] No hardcoded tenant name in Excel exports (tenant name pulled from DB at export time).
- [x] No hardcoded demo company slug in app pages (only in seed scripts).
- [x] Super Admin login exists (`super@b-attend.app`).
- [x] Employee cannot access `/admin` (HR-6.1 access control).
- [x] Branch Manager cannot access payroll (HR-6.1 branch scoping + payroll gates).
- [x] Payroll routes protected (subscription + permission + feature-gate checks).
- [x] Excel exports require auth (HR + payroll export routes are server-authed).
- [x] SQLite file is not used in production (schema is Postgres-only).

---

## 10. Not ready for production until…

- Replace demo passwords and force password change for all accounts.
- Configure real SMTP / email delivery + SPF/DKIM/DMARC.
- Add rate limiting on `/login` and `/signup`.
- Replace `AI_PROVIDER=mock` with a real provider + key if AI features are demoed for real.
- Set up PostgreSQL backups (`pg_dump`) and a restore test.
- Add monitoring/error tracking (Sentry / Vercel Analytics).
- Review Privacy Policy / Terms with legal; add cookie consent if serving EU users.
- Set `DEMO_SEED_CONFIRM=false` (already default) and remove demo tenant data before real launch.

See the historical Docker/self-host sections in git history if you need a non-Vercel deployment.
