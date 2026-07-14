# B-Attend

> Smart attendance and shift control for operational teams in Egypt & MENA.
>
> **Be present. Be verified.**

B-Attend is a production-ready multi-tenant SaaS platform for attendance, shift control, approvals, reporting, and payroll-ready workforce management — built for restaurants, cafes, cloud kitchens, retail chains, gyms, clinics, warehouses, security companies, cleaning companies, and multi-branch operational teams.

This repository contains **Phase 1** of the build. See `BUILD_PHASES.md` for the full roadmap.

---

## Tech stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5 (strict)
- **Database**: Prisma ORM with **SQLite** as a local-dev fallback (production should switch to PostgreSQL)
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York)
- **Auth**: bcryptjs password hashing + jose JWT sessions in HttpOnly cookies
- **Validation**: Zod + react-hook-form
- **Icons**: lucide-react
- **State**: React Server Components by default; client islands for forms and interactivity

---

## Architecture

### Multi-tenancy

Every tenant-scoped table carries a `companyId` column and is indexed on it. The plan is to enforce strict tenant scoping on every query via the helpers in `src/lib/auth/tenant.ts` (`getTenantId`, `getTenantContext`, `requireActiveSubscription`, `canUseFeature`, `checkPlanLimit`). Phase 1 ships scaffolding; Phases 2-7 wire real enforcement.

The platform layer (Super Admin, plans, leads, system settings, platform audit log, invoices, payments, coupons, billing events) is **not** tenant-scoped — it lives above tenants.

### Subscription model

- Plans are database-driven, not hard-coded.
- Each tenant has one active `Subscription` linked to a `Plan`.
- Subscription statuses: `TRIALING`, `PENDING_PAYMENT`, `ACTIVE`, `PAST_DUE`, `GRACE_PERIOD`, `SUSPENDED`, `CANCELLED`, `EXPIRED`, `MANUAL_REVIEW`.
- Manual activation is the default for B2B in Egypt & MENA.
- `SystemSetting.manualActivationMode = true` for Phase 1.

### Roles & permissions

**Platform roles** (`PlatformRole` enum):
- `SUPER_ADMIN` — everything
- `SALES_ADMIN` — leads, tenants read, activation requests
- `SUPPORT_AGENT` — tenants read, support tickets, limited impersonation
- `BILLING_ADMIN` — plans, invoices, subscriptions, payments

**Tenant roles** (`TenantUserRole` enum — defined for Phase 3+):
- `COMPANY_OWNER`, `HR_ADMIN`, `BRANCH_MANAGER`, `EMPLOYEE`

Permissions are designed to be capability-based (see `src/lib/auth/tenant.ts`).

### Auth flow

1. `POST /login` → `loginAction` Server Action validates credentials (PlatformUser first, then tenant User).
2. On success, `createSession()` signs a JWT with `{ sub, kind, role, name, email, tenantId? }` and sets it as an HttpOnly cookie (7-day expiry).
3. `src/middleware.ts` (will become `proxy.ts` per Next.js 16) protects `/admin/*` and all tenant routes.
4. `POST /api/auth/logout` destroys the session cookie.
5. Every login creates a `PlatformAuditLog` row.

---

## Phase 1 scope

Phase 1 delivers:

- ✅ Project setup (Next.js 16 + Tailwind 4 + shadcn/ui + Prisma + SQLite)
- ✅ Prisma schema — platform/SaaS layer fully modeled + tenant layer as stubs
- ✅ Seed data — 4 platform users, 5 plans with 14 features each, system settings, 3 demo leads
- ✅ Auth — bcrypt + JWT cookies + login/logout Server Actions + middleware
- ✅ Roles — platform role helpers (`requirePlatformRole`) + tenant role helpers (stubs)
- ✅ Tenant scoping — `getTenantId`, `requireActiveSubscription`, `canUseFeature`, `checkPlanLimit` (stubs)
- ✅ Base layout — `AppShell`, `Sidebar`, `Header`, `MobileBottomNav`, `PublicNav`, `PublicFooter`, `SubscriptionBanner`, `EmptyState`, status badges, brand tokens
- ✅ Public marketing pages — `/`, `/pricing`, `/features`, `/contact`, `/request-demo`, `/signup`, `/login`, `/legal/privacy`, `/legal/terms`
- ✅ Stub `/admin` dashboard with DB-backed stats (proves the data layer works)
- ✅ Audit logging on signup, login, lead creation

---

## Setup instructions

### Prerequisites

- Node.js 20+ (or Bun 1.3+)
- No PostgreSQL required for local dev (SQLite fallback)

### Install

```bash
bun install
```

### Environment

`.env` is provided with sensible dev defaults. For production, change `SESSION_SECRET` to a 32+ char random string and switch `DATABASE_URL` to a PostgreSQL connection string.

```bash
# Required
DATABASE_URL="file:./dev.db"           # SQLite for local dev
APP_URL="http://localhost:3000"
SESSION_SECRET="change-me-to-32+-chars"
MANUAL_ACTIVATION_MODE="true"

# Super Admin bootstrap (used by seed)
SUPER_ADMIN_EMAIL="super@b-attend.app"
SUPER_ADMIN_PASSWORD="demo1234"

# Optional (placeholders — Phase 1 does not send real email)
EMAIL_FROM="no-reply@b-attend.app"
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASS=""

# Payment (placeholders — Phase 1 uses MANUAL activation only)
PAYMENT_PROVIDER="MANUAL"
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
```

### Database setup

```bash
bun run db:push      # create/sync schema
bun prisma/seed.ts   # seed platform users, plans, features, system settings, leads
```

### Run

The dev server runs automatically in this sandbox. To run manually:

```bash
bun run dev
```

Visit `http://localhost:3000`.

### Build

```bash
bun run build
bun run start
```

### Typecheck

```bash
bunx tsc --noEmit
```

### Lint

```bash
bun run lint
```

---

## Demo accounts

All accounts share the password `demo1234`.

| Email | Role | Phase 1 access |
|-------|------|----------------|
| `super@b-attend.app` | SUPER_ADMIN | Login → `/admin` (Phase 2 placeholder dashboard) |
| `sales@b-attend.app` | SALES_ADMIN | Login → `/admin` (Phase 2) |
| `support@b-attend.app` | SUPPORT_AGENT | Login → `/admin` (Phase 2) |
| `billing@b-attend.app` | BILLING_ADMIN | Login → `/admin` (Phase 2) |

Tenant accounts (`owner@b-attend.app`, `hr@b-attend.app`, `manager@b-attend.app`, `employee@b-attend.app`) will be seeded in **Phase 3** alongside the demo tenant.

---

## Main features (Phase 1)

### Public marketing site

- **`/`** — Landing page with Hero, Problem, Solution, Features, How it works, Use cases, Pricing preview (DB-backed), Testimonials placeholder, FAQ, CTA.
- **`/pricing`** — DB-backed plan grid with monthly/annual toggle and a full feature matrix.
- **`/features`** — Feature cards grouped by category.
- **`/contact`** — Contact form (creates a `Lead` with `sourcePage="CONTACT"`).
- **`/request-demo`** — Demo request form (creates a `Lead` with `sourcePage="REQUEST_DEMO"`).
- **`/signup`** — Company owner signup (creates `Tenant` + `Subscription` + `Lead`, shows pending activation screen).
- **`/login`** — Credentials form for platform + tenant users.
- **`/legal/privacy`** and **`/legal/terms`** — Placeholder policies.

### Authenticated area

- **`/admin`** — Phase 2 placeholder. Shows DB-backed platform stats (total tenants, pending activations, plans, users, leads) and a recent leads table. Sidebar lists all upcoming Phase 2 routes with `P2` badges.

### Backend

- Bcrypt password hashing, JWT sessions in HttpOnly cookies.
- Zod validation on every Server Action.
- Audit log on signup, login, lead creation.
- Middleware-based route protection (`/admin/*` requires platform session; tenant routes require tenant session).

---

## Project structure

```
/home/z/my-project
├── prisma/
│   ├── schema.prisma         # Phase 1 models + tenant stubs
│   └── seed.ts               # 4 users + 5 plans + features + settings + leads
├── scripts/
│   └── check-db.ts           # utility for DB inspection
├── src/
│   ├── app/
│   │   ├── (auth)/actions.ts # login, signup, contact, demo, logout Server Actions
│   │   ├── admin/page.tsx    # Phase 2 stub dashboard
│   │   ├── api/auth/logout/  # logout route handler
│   │   ├── contact/page.tsx
│   │   ├── features/page.tsx
│   │   ├── legal/{privacy,terms}/page.tsx
│   │   ├── login/page.tsx
│   │   ├── pricing/{page,PricingClient}.tsx
│   │   ├── request-demo/page.tsx
│   │   ├── signup/{page,SignupClient}.tsx
│   │   ├── page.tsx          # landing
│   │   ├── layout.tsx        # root layout (B-Attend metadata)
│   │   └── globals.css       # brand tokens (deep navy + modern blue)
│   ├── components/
│   │   ├── banners/SubscriptionBanner.tsx
│   │   ├── badges/StatusBadges.tsx
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Logo.tsx
│   │   │   ├── MobileBottomNav.tsx
│   │   │   ├── PublicFooter.tsx
│   │   │   ├── PublicLayout.tsx
│   │   │   ├── PublicNav.tsx
│   │   │   └── Sidebar.tsx
│   │   └── ui-empty/EmptyState.tsx
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── audit.ts      # logPlatformEvent, logTenantEvent
│   │   │   ├── password.ts   # bcrypt hash/verify
│   │   │   ├── session.ts    # jose JWT cookies + role helpers
│   │   │   └── tenant.ts     # tenant scoping + feature gates (Phase 1 stubs)
│   │   ├── db.ts             # Prisma client
│   │   ├── i18n.ts           # en/ar dictionary stub
│   │   └── utils.ts
│   └── middleware.ts         # route protection
├── .env
├── package.json
└── README.md
```

---

## Known limitations (Phase 1)

1. **SQLite, not PostgreSQL** — Per spec line 91, SQLite is permitted as a temporary local fallback. Production must switch `DATABASE_URL` to PostgreSQL and re-run `prisma migrate dev`.
2. **`/admin` is a placeholder** — Real Super Admin dashboard, tenant activation workflow, plan editing, invoice creation, and payment recording arrive in Phase 2.
3. **No tenant users seeded** — `owner@b-attend.app`, `hr@b-attend.app`, etc. will be created in Phase 3 alongside the demo tenant (`B-Attend Demo Restaurant Group`).
4. **No operational routes yet** — `/dashboard`, `/branches`, `/employees`, `/schedules`, `/clock`, `/kiosk`, `/approvals`, `/reports`, `/audit`, `/billing`, `/settings`, `/support`, `/today`, `/attendance`, `/requests`, `/profile`, `/live`, `/policies`, `/users` are all Phase 3-7. Middleware redirects unauthenticated users to `/login`.
5. **No real email** — `EMAIL_FROM` / `SMTP_*` env vars are placeholders. Phase 1 logs to console.
6. **No real payment gateway** — Manual activation only. Stripe/Paymob/Fawry are placeholders.
7. **Middleware convention deprecated** — Next.js 16 prefers `proxy.ts` over `middleware.ts`. Functionality is identical; rename in Phase 2.
8. **Tenant scoping helpers are stubs** — `requireActiveSubscription`, `canUseFeature`, and `checkPlanLimit` return `true`/`{allowed:true}` for now. Real enforcement arrives in Phase 2.
9. **No biometric or face recognition** — Per spec, these remain placeholders until explicit consent flow is built.
10. **`SupportLevel` enum dropped `CUSTOM`** — Enterprise plan uses `PRIORITY` support level (custom onboarding is handled via `isCustom=true` flag, not a separate enum value) due to a Prisma SQLite enum validation issue. Will revisit in Phase 2.

---

## Production-readiness checklist (preview)

- [ ] Switch to PostgreSQL via `DATABASE_URL`
- [ ] Set `SESSION_SECRET` to a 32+ char random string
- [ ] Set `NODE_ENV=production`
- [ ] Configure SMTP for real email delivery
- [ ] Configure payment provider (Stripe/Paymob/Fawry) when ready
- [ ] Run `prisma migrate dev` to create migration history
- [ ] Enable rate limiting on `/login` and `/signup`
- [ ] Add CSRF tokens for non-Server-Action forms (Server Actions have built-in protection)
- [ ] Configure `Content-Security-Policy` headers
- [ ] Set up automated database backups
- [ ] Complete legal review for Egypt/MENA data protection compliance
- [ ] Add error monitoring (Sentry or equivalent)
- [ ] Add analytics (PostHog or equivalent)

---

## Compliance notes

B-Attend processes company information, employee personal data, and location data. The following applies:

- **Location**: Captured only at clock in/out. No continuous tracking. No background GPS.
- **Biometrics**: Face verification remains a placeholder. No biometric templates are stored in the MVP.
- **Consent**: Employers must inform employees and obtain required consents under applicable labor and data protection law before enabling location capture.
- **Data retention**: Audit log retention follows plan (30-730 days).
- **Legal review**: This README is not legal advice. Production use requires legal review for Egypt & MENA data protection compliance.

---

## Deployment notes

The project includes a `Caddyfile` for production reverse proxy. For Docker-based deployment:

1. Build the Next.js standalone output: `bun run build`
2. Run via `bun .next/standalone/server.js`
3. Mount the SQLite DB file (or switch to PostgreSQL)
4. Configure Caddy to proxy to port 3000

For platform-as-a-service (Vercel, Railway, etc.):
- Set all environment variables
- Switch `DATABASE_URL` to the provider's PostgreSQL connection string
- Run `prisma migrate deploy` post-build

---

## Phase 2 preview

Phase 2 will deliver the full Super Admin control center:

- Real `/admin` dashboard with MRR, ARR, churn, pending activations, overdue invoices
- `/admin/tenants` — list, filter, search, activate/suspend/cancel
- `/admin/tenants/[id]` — tenant detail with usage stats, audit log, invoices
- `/admin/subscriptions` — change plan, extend trial, override limits
- `/admin/plans` — edit plan limits and feature flags
- `/admin/invoices` — create invoice, mark paid, void
- `/admin/payments` — record manual payment
- `/admin/leads` — lead board with assignment and status workflow
- `/admin/audit` — platform audit log viewer
- `/admin/settings` — system settings UI
- Impersonation with reason + audit
- Force password reset for temp passwords

See `B-Attend/upload/Pasted Content_1784032406006.txt` (the spec) section 4 for full details.
