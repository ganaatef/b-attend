# B-Attend

> Smart attendance and shift control for operational teams in Egypt & MENA.
>
> **Be present. Be verified.**

B-Attend is a production-ready multi-tenant SaaS platform for attendance, shift control, approvals, reporting, and payroll-ready workforce management — built for restaurants, cafes, cloud kitchens, retail chains, gyms, clinics, warehouses, security companies, cleaning companies, and multi-branch operational teams.

This repository contains **Phase 1-8** of the build — the full product, ready to sell.

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

Every tenant-scoped table carries a `companyId` column and is indexed on it. Strict tenant scoping is enforced via:
- Server-side role checks (`requireTenant`, `requireTenantAdmin`, `requirePlatformRole`)
- `companyId` filter on every tenant query
- Middleware that redirects unauthenticated users to `/login`
- Branch managers see only their assigned branch (via `managerId` field)
- Employees see only their own data (via `userId` link on Employee)

### Subscription model

- Plans are database-driven, not hard-coded.
- Each tenant has one active `Subscription` linked to a `Plan`.
- Subscription statuses: `TRIALING`, `PENDING_PAYMENT`, `ACTIVE`, `PAST_DUE`, `GRACE_PERIOD`, `SUSPENDED`, `CANCELLED`, `EXPIRED`, `MANUAL_REVIEW`.
- Manual activation is the default for B2B in Egypt & MENA.
- Plan limits enforced on branch/employee creation (maxBranches, maxEmployees, maxManagers, maxKiosks).
- Feature flags per plan via `PlanFeature` table.

### Roles & permissions

**Platform roles** (`PlatformRole` enum):
- `SUPER_ADMIN` — everything
- `SALES_ADMIN` — leads, tenants read, activation requests
- `SUPPORT_AGENT` — tenants read, support tickets, impersonation with reason
- `BILLING_ADMIN` — plans, invoices, subscriptions, payments

**Tenant roles** (`TenantUserRole` enum):
- `COMPANY_OWNER` — full tenant access including billing and settings
- `HR_ADMIN` — operational full access except billing payment changes
- `BRANCH_MANAGER` — assigned branch only (dashboard, live attendance, schedules, approvals, reports, kiosk)
- `EMPLOYEE` — own pages only (today, clock, attendance, requests, profile)

### Auth flow

1. `POST /login` → `loginAction` Server Action validates credentials (PlatformUser first, then tenant User).
2. On success, `createSession()` signs a JWT with `{ sub, kind, role, name, email, tenantId? }` and sets it as an HttpOnly cookie (7-day expiry).
3. `src/middleware.ts` protects `/admin/*` (platform-only) and all tenant routes.
4. `POST /api/auth/logout` destroys the session cookie.
5. Every login/signup/important action creates an audit log entry (platform or tenant-scoped).
6. Impersonation: Super Admin / Support Agent can impersonate a tenant owner with reason — every impersonation is audit-logged, and the session is replaced (no silent impersonation).

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
DATABASE_URL="file:./dev.db"
APP_URL="http://localhost:3000"
SESSION_SECRET="change-me-to-32+-chars"
MANUAL_ACTIVATION_MODE="true"
SUPER_ADMIN_EMAIL="super@b-attend.app"
SUPER_ADMIN_PASSWORD="demo1234"
EMAIL_FROM="no-reply@b-attend.app"
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASS=""
PAYMENT_PROVIDER="MANUAL"
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
```

### Database setup

```bash
bun run db:push      # create/sync schema
bun prisma/seed.ts   # seed platform users, plans, demo tenant, employees, schedules, invoices, leads
```

### Run

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

### Platform accounts (B-Attend internal team)

| Email | Role | Access |
|-------|------|--------|
| `super@b-attend.app` | SUPER_ADMIN | `/admin` — full Super Admin control center |
| `sales@b-attend.app` | SALES_ADMIN | `/admin` — leads, tenant activation |
| `support@b-attend.app` | SUPPORT_AGENT | `/admin` — support tickets, impersonation |
| `billing@b-attend.app` | BILLING_ADMIN | `/admin` — plans, invoices, payments |

### Tenant accounts (B-Attend Demo Restaurant Group)

| Email | Role | Access |
|-------|------|--------|
| `owner@b-attend.app` | COMPANY_OWNER | `/dashboard` — full tenant access |
| `hr@b-attend.app` | HR_ADMIN | `/dashboard` — operational + employees + reports |
| `manager@b-attend.app` | BRANCH_MANAGER | `/dashboard` — New Cairo branch only |
| `manager2@b-attend.app` | BRANCH_MANAGER | `/dashboard` — Nasr City branch only |
| `employee@b-attend.app` | EMPLOYEE | `/today` — self-service clock + requests |

The demo tenant has 3 branches (New Cairo, Nasr City, Maadi), 6 departments, 5 shift policies, 15 employees, current-month schedules, sample punches, 3 approval requests, 3 invoices (paid + pending + overdue), 1 support ticket, and 3 demo leads.

---

## Main features

### Public marketing site
- `/` Landing page with DB-backed pricing preview
- `/pricing` Plan grid with monthly/annual toggle + full feature matrix
- `/features` Feature cards grouped by category
- `/contact` Lead capture form
- `/request-demo` Demo request form
- `/signup` Company owner signup → creates Tenant + Subscription + Lead
- `/login` Credentials form (platform + tenant users)
- `/legal/privacy` and `/legal/terms` Placeholder policies

### Super Admin control center (`/admin/*`)
- `/admin` Real dashboard with MRR, ARR, total tenants, pending activations, overdue invoices, open tickets, clock actions today
- `/admin/tenants` List + filter + `/admin/tenants/[id]` detail with activate/suspend/reactivate/cancel/reject/impersonate actions, change plan, create manual invoice
- `/admin/subscriptions` All subscriptions across tenants
- `/admin/plans` + `/admin/plans/[id]` Edit plan limits and feature flags
- `/admin/invoices` Create invoice, mark paid, void
- `/admin/payments` Payment history
- `/admin/leads` Lead board with status workflow + assignment
- `/admin/audit` Platform audit log (filterable by action)
- `/admin/users` All platform + tenant users
- `/admin/support` + `/admin/support/[id]` Ticket queue with reply form
- `/admin/settings` System settings (trial days, grace period, currency, payment provider)
- `/admin/system` Health check (DB, app, env)
- `/admin/reports` Subscription usage report

### Customer app (`/dashboard`, `/onboarding`, etc.)
- `/dashboard` Owner/HR dashboard with stats + recent exceptions + quick links
- `/onboarding` 7-step wizard (profile → branch → departments → policies → employees → schedules → review)
- `/branches` + `/branches/[id]` CRUD with plan limit enforcement
- `/departments` Quick add/delete
- `/employees` + `/employees/[id]` + `/employees/new` CRUD with plan limit enforcement
- `/policies` Shift policies with overnight support
- `/schedules` + `/schedules/bulk` Single + bulk schedule generation with weekend skip
- `/clock` Mobile web clock with browser geolocation + geofence validation
- `/kiosk` PIN/code-based kiosk mode for shared tablets
- `/live` Real-time attendance feed (today)
- `/approvals` + `/approvals/[id]` Approval workflow (8 types: manual clock in/out, missing clock out, outside geofence, overtime, attendance adjustment, leave request, permission request)
- `/requests` Employee self-service request submission
- `/reports` 6 report types (daily, monthly, exceptions, overtime, branch, payroll) with CSV export (UTF-8 BOM)
- `/audit` Tenant audit log
- `/settings` Customer settings (geofence radius, grace, overtime threshold, toggles)
- `/billing` Plan usage + invoices + upgrade prompt
- `/support` + `/support/[id]` Support tickets with reply
- `/users` Invite users (HR/Branch Manager/Employee) with temp password + force change
- `/today` Employee dashboard
- `/attendance` Employee attendance history
- `/profile` Account + employee details

### Attendance engine
- `recalculateAttendanceDay(employeeId, date)` — recomputes all metrics (late, early leave, overtime, missing clock out, outside geofence, absent, no schedule) and upserts AttendanceDay
- `markAbsentForPastScheduledDays({ companyId?, daysBack })` — marks ABSENT for past scheduled days with no clock-in
- `POST /api/system/mark-absent` — admin/owner trigger
- Haversine distance calculation for geofence validation

### CSV export
- UTF-8 BOM for Arabic compatibility
- Proper escaping of quotes, commas, newlines
- 6 report types respect filters (date range, branch)
- Every export logged to `ReportExportLog` + `AuditLog`

### Security
- bcrypt password hashing
- HttpOnly + SameSite cookies, 7-day expiry
- Server-side role + tenant checks on every mutation
- Plan feature gating
- Subscription status gating (PENDING_ACTIVATION → activation screen)
- Branch scoping for branch managers
- Employee self-only data access
- Impersonation with reason + audit log
- Zod validation on all Server Action inputs

---

## Project structure

```
/home/z/my-project
├── prisma/
│   ├── schema.prisma             # ~40 models + 25 enums
│   └── seed.ts                   # full demo data
├── scripts/
│   └── check-db.ts               # DB inspection utility
├── src/
│   ├── app/
│   │   ├── (auth)/actions.ts     # login, signup, contact, demo, logout
│   │   ├── (tenant)/             # customer app (route group)
│   │   │   ├── actions.ts        # branches, departments, employees, policies, schedules
│   │   │   ├── approvals/actions.ts
│   │   │   ├── clock/actions.ts
│   │   │   ├── settings/actions.ts
│   │   │   ├── layout.tsx        # tenant shell with subscription banner
│   │   │   ├── dashboard/ onboarding/ branches/ employees/ departments/
│   │   │   ├── policies/ schedules/ clock/ kiosk/ live/ approvals/
│   │   │   ├── requests/ reports/ audit/ settings/ billing/ support/ users/
│   │   │   ├── today/ attendance/ profile/
│   │   ├── admin/                # super admin (route group)
│   │   │   ├── actions.ts        # tenant lifecycle, plans, invoices, leads, impersonation, settings
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx          # dashboard
│   │   │   ├── tenants/ subscriptions/ plans/ invoices/ payments/ leads/
│   │   │   ├── audit/ users/ support/ settings/ system/ reports/
│   │   ├── api/
│   │   │   ├── auth/logout/      # POST logout
│   │   │   ├── public/plans/     # GET active plans (for client selects)
│   │   │   ├── system/mark-absent/  # POST mark-absent
│   │   │   ├── tenant/reports/csv/  # GET CSV export
│   │   ├── login/ signup/ contact/ request-demo/ pricing/ features/ legal/
│   │   ├── page.tsx              # landing
│   │   ├── layout.tsx            # root layout
│   │   └── globals.css           # brand tokens
│   ├── components/
│   │   ├── layout/               # AppShell, Sidebar, Header, MobileBottomNav, PublicNav, PublicFooter, Logo
│   │   ├── badges/               # status badges
│   │   ├── banners/              # SubscriptionBanner
│   │   └── ui-empty/             # EmptyState
│   ├── lib/
│   │   ├── auth/                 # session, password, audit, tenant scoping
│   │   ├── attendance/engine.ts  # recalculateAttendanceDay, markAbsent, haversine
│   │   ├── csv.ts                # toCsv with BOM
│   │   ├── db.ts                 # Prisma client
│   │   ├── i18n.ts               # en/ar dictionary
│   │   └── utils.ts
│   └── middleware.ts             # route protection
├── .env
├── package.json
├── README.md
├── DEMO.md
├── TESTING.md
└── DEPLOYMENT.md
```

---

## Known limitations

1. **SQLite, not PostgreSQL** — Per spec line 91, SQLite is permitted as a temporary local fallback. Production must switch `DATABASE_URL` to PostgreSQL and re-run `prisma migrate dev`.
2. **No real email** — `EMAIL_FROM` / `SMTP_*` env vars are placeholders. Phase 1 logs to console. Production should wire nodemailer or a transactional email service.
3. **No real payment gateway** — Manual activation only. Stripe/Paymob/Fawry are placeholders. Invoices are created and marked paid manually by billing admin.
4. **Middleware convention deprecated** — Next.js 16 prefers `proxy.ts` over `middleware.ts`. Functionality is identical; rename in a future polish pass.
5. **No biometric or face recognition** — Per spec, these remain placeholders until explicit consent flow is built.
6. **No background location tracking** — Location is captured only at clock in/out, per spec.
7. **`SupportLevel` enum has no `CUSTOM` value** — Enterprise plan uses `PRIORITY` + `isCustom=true` flag due to a Prisma SQLite enum issue.
8. **No password reset flow** — Super Admin can reset owner password (placeholder); tenant user password reset is a Phase 8 polish item.
9. **No real-time push** — `/live` page requires manual refresh. WebSocket could be added in a future phase.
10. **No leave balance tracking** — Leave requests just mark schedule as LEAVE; no annual/sick leave balance accrual (per spec, kept simple).
11. **No mobile app** — Mobile web is responsive and PWA-ready but no native app.
12. **No Arabic RTL UI** — i18n dictionary has Arabic stubs but UI is English-first. RTL flip is a Phase 8 polish item.

---

## Production-readiness checklist

- [ ] Switch to PostgreSQL via `DATABASE_URL`
- [ ] Set `SESSION_SECRET` to a 32+ char random string
- [ ] Set `NODE_ENV=production`
- [ ] Configure SMTP for real email delivery
- [ ] Configure payment provider (Stripe/Paymob/Fawry) when ready
- [ ] Run `prisma migrate dev` to create migration history
- [ ] Enable rate limiting on `/login` and `/signup`
- [ ] Configure `Content-Security-Policy` headers
- [ ] Set up automated database backups
- [ ] Complete legal review for Egypt/MENA data protection compliance
- [ ] Add error monitoring (Sentry or equivalent)
- [ ] Add analytics (PostHog or equivalent)
- [ ] Set up cron job for `markAbsentForPastScheduledDays` (daily at 02:00)
- [ ] Add password reset flow with email tokens
- [ ] Add 2FA for Super Admin accounts
- [ ] Configure Cloudflare or equivalent DDoS protection
- [ ] Set up staging environment for testing changes

---

## Compliance notes

B-Attend processes company information, employee personal data, and location data. The following applies:

- **Location**: Captured only at clock in/out. No continuous tracking. No background GPS.
- **Biometrics**: Face verification remains a placeholder. No biometric templates are stored.
- **Consent**: Employers must inform employees and obtain required consents under applicable labor and data protection law before enabling location capture.
- **Data retention**: Audit log retention follows plan (30-730 days).
- **Legal review**: This README is not legal advice. Production use requires legal review for Egypt & MENA data protection compliance.

---

## Deployment

See `DEPLOYMENT.md` for full deployment instructions including Docker, Vercel, and self-hosted options.

---

## Demo

See `DEMO.md` for step-by-step demo flows covering Super Admin, Customer Owner, Employee, and Manager personas.

---

## Testing

See `TESTING.md` for the full test checklist covering auth, tenant isolation, subscription gating, plan limits, and all operational flows.

---

# B-Coach AI Module (Phase 9)

B-Coach is an optional AI-powered staff development module that helps employees understand their attendance behavior, improve punctuality, stay motivated, and receive daily short development content. It also helps managers identify staff who may need support, coaching, or follow-up.

## Product philosophy

B-Coach is **supportive, respectful, and development-oriented**. It is NOT a punishment tool.

- It does not shame employees.
- It does not diagnose psychological or medical conditions.
- It does not make final HR decisions.
- It does not recommend firing, salary deduction, or disciplinary action automatically.
- It provides **coaching insights**, not punishment decisions.

## What B-Coach does

- **Employee AI Coach Dashboard** (`/coach`) — weekly + monthly summaries, strengths, improvement areas, daily advice, daily motivation, tomorrow action, progress streak, recent achievements, development tips.
- **Daily AI Motivation** — short, practical, friendly, work-focused, Egyptian/MENA-friendly content (no religious, political, medical, or sensitive claims; no fake quotes from real people).
- **Manager AI Insights** (`/team-coach`) — team coaching overview, employees needing attention, improving employees, top consistency, suggested manager actions, daily briefing.
- **Daily Briefing** (`/daily-briefing`) — short briefing for managers to read to staff before shift (theme + 3 talking points + operational reminder + motivation).
- **Coach Tips Library** (`/coach-library`) — owner/HR manage custom tips; super admin manages system defaults (`/admin/coach-library`).
- **Consistency Score** — non-punitive 0-100 score for coaching only. Levels: EXCELLENT / GOOD / NEEDS_ATTENTION / NEEDS_SUPPORT.
- **Super Admin AI Controls** (`/admin/ai`) — global enable/disable, default provider, per-tenant toggle, usage logs, system tips management.

## AI provider abstraction

All AI logic is isolated in `src/lib/ai/provider.ts`. The system supports:

- **MOCK provider** (default) — deterministic template-based generation. No API key required. The app runs fully without any external AI service.
- **OPENAI provider** (placeholder) — uses `OPENAI_API_KEY` if set. Currently falls back to MOCK if no key is present. Full OpenAI integration is a future enhancement.

### Environment variables

```bash
AI_PROVIDER=mock              # or "openai" (will fall back to mock if no key)
OPENAI_API_KEY=               # optional, only needed if AI_PROVIDER=openai
AI_DAILY_COACH_ENABLED=true
AI_EMPLOYEE_INSIGHTS_ENABLED=true
```

### AI functions

- `generateDailyMotivation(input)` — returns title + body + theme for the day.
- `generateEmployeeCoachSummary(input)` — returns positiveSummary, improvementAreas, practicalAdvice, tomorrowAction, riskLevel, tags.
- `generateManagerTeamInsights(input)` — returns team summary, needs-support list, improving list, top consistency list, suggested manager actions, daily briefing text.
- `generateDailyBriefing(input)` — returns theme, talking points, operational reminder, motivation, branch note.

Every AI call is logged to `AiUsageLog` (best-effort).

## Feature gates

B-Coach features are gated by plan:

| Feature | Trial | Starter | Growth | Pro | Enterprise |
|---------|-------|---------|--------|-----|------------|
| daily_motivation | ✓ | ✓ | ✓ | ✓ | ✓ |
| ai_coach | — | ✓ | ✓ | ✓ | ✓ |
| manager_ai_insights | — | — | ✓ | ✓ | ✓ |
| coach_library | — | — | ✓ | ✓ | ✓ |
| daily_briefing | — | — | — | ✓ | ✓ |

If a feature is not in the plan, the page shows an upgrade prompt. **Attendance data is never hidden** — only AI-generated coaching is gated.

Super Admin can also disable AI globally or per-tenant via `/admin/ai`.

## Privacy and compliance

- AI uses **attendance and scheduling data only**.
- AI must not infer medical, psychological, political, religious, or sensitive personal attributes.
- AI must not decide punishments.
- AI must not recommend termination.
- AI must not expose one employee's data to another employee.
- Employee-facing coaching is **constructive and respectful** — never shaming.
- Manager-facing insights are **factual and based on attendance records**.

> AI coaching is for development support only and not a replacement for HR judgment or legal compliance.

## Database models added

- `DailyCoachContent` — daily motivation content per tenant/date/audience/language.
- `CoachTip` — coaching tips (system default + tenant custom).
- `EmployeeCoachSnapshot` — per-employee AI summary snapshot.
- `TeamCoachSnapshot` — per-team AI insights snapshot.
- `AiUsageLog` — every AI call logged with provider, tokens, status.
- `TenantAiSetting` — per-tenant AI feature toggles.

`SystemSetting` extended with: `aiModuleEnabled`, `aiProvider`, `aiDailyCoachEnabled`, `aiEmployeeInsightsEnabled`.

## Routes added

**Employee**: `/coach`
**Manager/HR/Owner**: `/team-coach`, `/daily-briefing`, `/coach-library`
**Super Admin**: `/admin/ai`, `/admin/coach-library`
**API**: `/api/coach/employee-summary`, `/api/coach/team-summary`, `/api/coach/daily-content`, `/api/coach/tips`, `/api/admin/ai/settings`, `/api/admin/ai/usage`

## How to test without an AI key

B-Coach works out of the box with the MOCK provider. No setup needed:

1. Login as `employee@b-attend.app` / `demo1234` → visit `/coach` to see your AI coach dashboard.
2. Login as `owner@b-attend.app` / `demo1234` → visit `/team-coach` to see team insights.
3. Visit `/daily-briefing` → see today's briefing.
4. Visit `/coach-library` → see custom + system tips.
5. Login as `super@b-attend.app` / `demo1234` → visit `/admin/ai` to see AI controls + usage logs.

## Known limitations

1. **MOCK provider only** — OpenAI integration is a placeholder. To enable real AI generation, set `AI_PROVIDER=openai` + `OPENAI_API_KEY` and implement the OpenAI calls in `src/lib/ai/provider.ts`.
2. **No real-time push** — `/coach` and `/team-coach` regenerate on each visit. Daily motivation is cached per day per tenant.
3. **No WhatsApp/email notifications** — in-app notifications only. Email/WhatsApp placeholders for later.
4. **No Arabic RTL UI for coach** — motivation templates have AR stubs but UI is English-first.
5. **No leave balance integration** — coach summaries use attendance records only, no leave balance data.
6. **Daily briefing theme is deterministic** — picked by day-of-year, not personalized per branch performance.

## Future OpenAI integration notes

To wire real OpenAI generation:

1. Set `AI_PROVIDER=openai` and `OPENAI_API_KEY` in `.env`.
2. In `src/lib/ai/provider.ts`, replace the template fallback in each `generate*` function with a real `fetch("https://api.openai.com/v1/chat/completions", ...)` call.
3. Use the system prompt to enforce the same supportive, non-shaming tone.
4. Log tokens in/out + cost estimate to `AiUsageLog`.
5. Add rate limiting per tenant to control costs.
6. Add a fallback to MOCK if the OpenAI call fails (so the app never crashes).
