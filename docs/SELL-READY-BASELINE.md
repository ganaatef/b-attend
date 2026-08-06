# B-Attend Sell-Ready Pilot — Baseline Record

## Release Branch: `release/sell-ready-pilot`

## Environment
- **Current main commit:** `06e0e13` (feat: error boundaries + rate limiter fix)
- **Node version:** v24.16.0
- **Package manager:** npm (package-lock.json canonical)
- **Next.js:** 16.2.10
- **Prisma:** 6.19.3
- **Production URL:** https://b-attend.vercel.app
- **Git remote:** https://github.com/ganaatef/b-attend.git

## Baseline Checks (all pass)
| Check | Result |
|-------|--------|
| `npm ci` | ✅ Clean install |
| `npx prisma validate` | ✅ Schema valid |
| `npx prisma generate` | ✅ Client generated |
| `npx tsc --noEmit` | ✅ Zero errors |
| `npm run lint` | ✅ Zero warnings |
| `npm run i18n:check` | ✅ 2760/2760 EN/AR keys, 0 missing |
| `npm run build` | ✅ All 130+ routes compiled |

## Route Inventory
- **12 public routes** (landing, pricing, auth, legal)
- **18 platform admin routes** (/admin/*)
- **76 tenant routes** (dashboard, HR, payroll, schedules, approvals, etc.)
- **23 API routes** (coach, HR exports, auth, system)
- **Total: 129 routes**

## Role System
### Platform roles: SUPER_ADMIN, BILLING_ADMIN, SALES_ADMIN, SUPPORT_AGENT
### Tenant roles: COMPANY_OWNER, HR_ADMIN, BRANCH_MANAGER, EMPLOYEE
### HR permissions: 17 granular permissions via `hasPermission()`

## Environment Variables (22 total, 0 client-side)
- **Secrets:** DATABASE_URL, DIRECT_URL, SESSION_SECRET, SMTP_PASS, OPENAI_API_KEY
- **Feature flags:** AI_DAILY_COACH_ENABLED, AI_EMPLOYEE_INSIGHTS_ENABLED, AI_MANAGER_INSIGHTS_ENABLED, MANUAL_ACTIVATION_MODE, PAYMENT_PROVIDER, DEMO_SEED_CONFIRM
- **Config:** APP_URL, NODE_ENV, EMAIL_FROM, SMTP_HOST, SMTP_PORT, SMTP_USER, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD

## Demo Accounts
- **Platform:** super@b-attend.app, sales@b-attend.app, support@b-attend.app, billing@b-attend.app
- **Tenant:** owner@b-attend.app, hr@b-attend.app, manager@b-attend.app, manager2@b-attend.app, employee@b-attend.app
- **Password:** demo1234 (ALL accounts — MUST be rotated in Phase 1)
