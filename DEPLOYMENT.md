# B-Attend — Deployment Guide

This document covers deploying B-Attend to production.

---

## Prerequisites

- Node.js 20+ or Bun 1.3+
- PostgreSQL 14+ (production database — SQLite is local-dev only)
- SMTP credentials for transactional email (optional in Phase 1)
- Domain + SSL certificate
- (Optional) Docker + Docker Compose

---

## Option 1: Docker Compose (recommended for self-hosting)

### 1. Create `docker-compose.yml`

```yaml
version: "3.9"
services:
  db:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: battend
      POSTGRES_USER: battend
      POSTGRES_PASSWORD: ${DB_PASSWORD:-change-me}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  app:
    build: .
    restart: always
    depends_on:
      - db
    environment:
      DATABASE_URL: postgresql://battend:${DB_PASSWORD:-change-me}@db:5432/battend?schema=public
      APP_URL: https://your-domain.com
      SESSION_SECRET: ${SESSION_SECRET:-change-me-to-32-chars}
      EMAIL_FROM: no-reply@your-domain.com
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      PAYMENT_PROVIDER: MANUAL
      MANUAL_ACTIVATION_MODE: "true"
      SUPER_ADMIN_EMAIL: super@b-attend.app
      SUPER_ADMIN_PASSWORD: ${SUPER_ADMIN_PASSWORD:-change-me}
      NODE_ENV: production
    ports:
      - "3000:3000"

  caddy:
    image: caddy:2-alpine
    restart: always
    depends_on:
      - app
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

volumes:
  pgdata:
  caddy_data:
  caddy_config:
```

### 2. Create `Dockerfile`

```dockerfile
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run db:generate
RUN bun run build

FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
EXPOSE 3000
CMD ["bun", ".next/standalone/server.js"]
```

### 3. Create `Caddyfile`

```caddyfile
your-domain.com {
    reverse_proxy app:3000
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
    }
}
```

### 4. Deploy

```bash
# Set environment variables
export DB_PASSWORD=$(openssl rand -hex 24)
export SESSION_SECRET=$(openssl rand -hex 32)
export SUPER_ADMIN_PASSWORD=$(openssl rand -hex 12)
export SMTP_HOST=smtp.your-provider.com
export SMTP_USER=your-smtp-user
export SMTP_PASS=your-smtp-pass

# Start
docker compose up -d

# Run migrations + seed
docker compose exec app bun prisma/migrate deploy
docker compose exec app bun prisma/seed.ts

# Verify
curl https://your-domain.com/
```

### 5. Configure `next.config.ts` for standalone output

Add to `next.config.ts`:

```typescript
const nextConfig = {
  output: "standalone",
};
```

---

## Option 2: Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "B-Attend production release"
git push origin main
```

### 2. Create new project on Vercel

- Import from GitHub
- Framework preset: Next.js
- Build command: `bun run build`
- Output directory: `.next`
- Install command: `bun install`

### 3. Add environment variables in Vercel dashboard

- `DATABASE_URL` — your PostgreSQL connection string (use Vercel Postgres or external)
- `APP_URL` — `https://your-app.vercel.app`
- `SESSION_SECRET` — 32+ char random string
- `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `PAYMENT_PROVIDER` — `MANUAL`
- `MANUAL_ACTIVATION_MODE` — `true`
- `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`

### 4. Add PostgreSQL

Use Vercel Postgres (free tier) or external (Supabase, Neon, Railway).

### 5. Run migrations + seed

```bash
# In Vercel dashboard → Storage → your-db → Connect
# Or via CLI:
npx vercel env pull .env.production.local
bun run db:generate
bun run db:migrate
bun prisma/seed.ts
```

### 6. Deploy

Push to main → Vercel auto-deploys.

### 7. Configure custom domain

Vercel dashboard → Domains → add `your-domain.com` → configure DNS.

---

## Option 3: Railway / Render / Fly.io

Similar to Vercel but with persistent filesystem (better for SQLite if you really need it).

1. Push to GitHub
2. Create new web service on Railway/Render/Fly
3. Set environment variables (same as Vercel)
4. Set build command: `bun install && bun run build`
5. Set start command: `bun .next/standalone/server.js`
6. Add PostgreSQL add-on
7. Run migrations + seed via SSH/console

---

## Post-deployment checklist

### 1. Verify the app is up

```bash
curl https://your-domain.com/                    # Should return 200 + landing page HTML
curl https://your-domain.com/api/public/plans    # Should return JSON with 5 plans
```

### 2. Login as Super Admin

- Visit `https://your-domain.com/login`
- Login with `super@b-attend.app` / your `SUPER_ADMIN_PASSWORD`
- Should redirect to `/admin`
- Verify dashboard shows metrics (1 tenant, 5 plans, 4 platform users)

### 3. Change Super Admin passwords

After verifying the seed worked, immediately change all platform user passwords via the database or a one-off script:

```sql
-- Generate new bcrypt hash, then update
UPDATE PlatformUser SET passwordHash = '$2b$10$NEW_HASH_HERE' WHERE email = 'super@b-attend.app';
```

### 4. Set up backups

- **PostgreSQL**: Configure daily `pg_dump` backups to S3 / cloud storage
- **Audit log**: Export monthly to cold storage (S3 Glacier)
- **Test restore**: Verify backups work by restoring to a staging DB

### 5. Set up monitoring

- **Uptime**: UptimeRobot or Better Stack monitoring `/` every 5 minutes
- **Errors**: Sentry or equivalent for runtime errors
- **Performance**: Vercel Analytics or PostHog for web vitals
- **Logs**: Centralized log aggregation (Logtail, Datadog)

### 6. Set up cron jobs

- **Daily at 02:00 (server time)**: Run `markAbsentForPastScheduledDays` for all tenants
  ```bash
  curl -X POST https://your-domain.com/api/system/mark-absent \
    -H "Content-Type: application/json" \
    -H "Cookie: $SUPER_ADMIN_SESSION_COOKIE" \
    -d '{"daysBack": 1}'
  ```
  Or use a server-side cron / Vercel Cron / Railway Cron.
- **Weekly**: Export audit log to cold storage
- **Monthly**: Generate invoice reminders for overdue invoices

### 7. Configure email

- Set up SPF, DKIM, DMARC records for your domain
- Test email delivery with [mail-tester.com](https://www.mail-tester.com/)
- Set up bounce handling (SuppressionList in your ESP)

### 8. Configure payment provider (when ready)

- **Stripe**: Set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`, implement webhook handler
- **Paymob**: Sign up at [paymob.com](https://paymob.com), get API key, implement iframe redirect
- **Fawry**: Sign up at [fawry.com](https://fawry.com), get merchant code, implement Fawry reference codes

Until then, manual activation via Super Admin dashboard is the default.

### 9. Security hardening

- Set `SESSION_SECRET` to a 32+ char random string (use `openssl rand -hex 32`)
- Enable rate limiting on `/login` and `/signup` (use `@upstash/ratelimit` or Vercel Edge Config)
- Configure CSP headers (Caddy config above includes HSTS)
- Set up DDoS protection (Cloudflare free tier)
- Enable 2FA for Super Admin accounts (Phase 8 polish)

### 10. Legal & compliance

- Have a lawyer review `Privacy Policy` and `Terms of Service`
- Register with Egyptian Personal Data Protection Act (if applicable)
- Add cookie consent banner if serving EU users (GDPR)
- Document data retention policy per plan
- Set up data export / deletion workflow for user requests

---

## Rollback procedure

If a deployment breaks something:

### Vercel
1. Vercel dashboard → Deployments → previous deployment → "Instant Rollback"

### Docker Compose
```bash
# Revert to previous image
docker compose down
docker compose pull app:previous
docker compose up -d
```

### Database rollback
```bash
# Prisma migrate can rollback
bun run db:migrate reset  # WARNING: this drops all data
# Or restore from backup
pg_restore -d battend -c backup.sql
```

---

## Scaling considerations

- **Vertical**: Increase CPU/RAM on the app server (4GB+ RAM recommended for Prisma + Next.js)
- **Horizontal**: Add multiple app instances behind a load balancer (sticky sessions not required — JWT in cookies)
- **Database**: Use connection pooling (PgBouncer) when scaling horizontally
- **CDN**: Put Cloudflare in front for static assets + DDoS protection
- **Background jobs**: Move `markAbsent` to a worker process (BullMQ + Redis) when tenant count > 100
- **Search**: For >10k employees, add full-text search (Postgres FTS or Meilisearch)

---

## Troubleshooting

### Database connection fails
- Verify `DATABASE_URL` is correct
- Check PostgreSQL is running: `docker compose ps db`
- Check network: `psql $DATABASE_URL` from the app container
- Verify Prisma Client is generated: `bun run db:generate`

### Login redirects loop
- Check `SESSION_SECRET` is set and consistent across instances
- Check cookie domain matches `APP_URL`
- Clear browser cookies and retry

### Prisma Client out of sync
- After schema changes: `bun run db:push` then `bun run db:generate`
- Restart dev server: `bun run dev`
- For production: rebuild Docker image

### CSV export shows garbled Arabic
- Verify `toCsv()` includes UTF-8 BOM (`\uFEFF`) — it does
- Check `Content-Type: text/csv; charset=utf-8` header
- If opening in Excel on Windows, ensure Excel is set to detect UTF-8

### Geolocation not working on mobile
- HTTPS is required for `navigator.geolocation` — ensure SSL is configured
- iOS Safari requires user gesture (button click) — that's how `/clock` is built
- Some browsers block insecure origins — use HTTPS in production

---

## Production environment variables reference

```bash
# Database (REQUIRED)
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public

# App
APP_URL=https://your-domain.com
NODE_ENV=production

# Session (REQUIRED)
SESSION_SECRET=<32+ char random string>

# Email (optional in Phase 1, required for production)
EMAIL_FROM=no-reply@your-domain.com
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-pass

# Payments (placeholders for now)
PAYMENT_PROVIDER=MANUAL
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Activation mode
MANUAL_ACTIVATION_MODE=true

# Super Admin bootstrap (used by seed)
SUPER_ADMIN_EMAIL=super@b-attend.app
SUPER_ADMIN_PASSWORD=<strong password>
```
