# B-Attend Founding Customer Pilot — Final Release Candidate Report

## Release: `release/sell-ready-pilot`

## Automated Verification — ALL PASS

| Check | Result | Details |
|-------|--------|---------|
| `npx tsc --noEmit` | ✅ PASS | Zero TypeScript errors |
| `npm run lint` | ✅ PASS | Zero ESLint warnings |
| `npm run i18n:check` | ✅ PASS | 2783/2783 EN/AR keys, 0 missing, 0 source keys missing |
| `npm run build` | ✅ PASS | 135+ routes compiled successfully |

## Commits by Phase

| Phase | Commit | Description |
|-------|--------|-------------|
| 0 | `0b78826` | Establish sell-ready release baseline |
| 1 | `180e6e8` | Harden authentication credentials and recovery |
| 2 | `cd40718` | Enforce tenant and branch isolation |
| 3 | `a8a9404` | Make scheduling operational and employee-visible |
| 4-5 | `63a5777` | Kiosk device trust, sensitive data protection |
| 6 | `1df2ead` | Rebuild bilingual UI typography and RTL behavior |
| 7-8 | `e5df550` | Billing/payroll/AI claims + production reliability |
| 9 | `dabcbf1` | Customer trust and compliance surfaces |

## Schema Changes (Additive Only — No Data Loss)

| Model | Changes |
|-------|---------|
| PlatformUser | +failedLoginAttempts, +lockedUntil, +lastPasswordChangeAt |
| User | +failedLoginAttempts, +lockedUntil, +lastPasswordChangeAt |
| Employee | +pinHash |
| Tenant | +kioskDevices relation |
| Branch | +kioskDevices relation |
| **NEW** PasswordResetToken | Token-based password reset (SHA-256 hashed) |
| **NEW** PlatformPasswordResetToken | Platform admin password reset |
| **NEW** KioskDevice | Device trust and lifecycle management |

## Security Fixes Implemented

### CRITICAL (4 fixed)
1. deleteEmployeeAction — added companyId to WHERE clause
2. createEmployeeAction — validate branchId/departmentId/policyId belong to tenant
3. clockAction — added tenant auth gate, scoped employee lookup
4. decideRequestAction — prevent self-approval of requests

### HIGH (4 fixed)
5. HR actions — validate employeeId/courseId belong to tenant (6 actions)
6. updateBranchAction — field allowlist + companyId in WHERE
7. updateEmployeeAction — field allowlist + companyId in WHERE
8. submitRequestAction — restrict branch manager to managed branch employees

### MEDIUM (2 fixed)
9. cancelRequestAction — require PENDING status before cancellation
10. decideRequestAction — centralized getManagedBranchIds helper

### Authentication (5 improvements)
11. Removed hardcoded JWT secret fallback
12. Added per-account login rate limiting (5 attempts → 15min lockout)
13. Added forcePasswordChange enforcement
14. Added forgot-password flow (token-based)
15. Added change-password page

### Infrastructure (6 improvements)
16. Error boundaries (global, root, tenant, admin)
17. Rate limiter bucket key fix
18. Security headers (HSTS, CSP, nosniff, DENY, XSS protection)
19. reactStrictMode enabled
20. Health check endpoint
21. Structured logging

## New Routes Added

| Route | Purpose |
|-------|---------|
| `/forgot-password` | Password reset request |
| `/reset-password` | Password reset confirmation |
| `/change-password` | Forced password change |
| `/privacy` | Employee data request |
| `/api/health` | Health check endpoint |

## What's Included in Pilot

- ✅ Attendance (clock in/out, geofence, kiosk)
- ✅ Schedules (single + bulk, employee self-service)
- ✅ Approvals (submit, decide, cancel)
- ✅ Employee self-service (today, my-schedule, my-leave, requests)
- ✅ Leave and core HR
- ✅ Excel reports
- ✅ Payroll preparation (with disclaimer)
- ✅ Assisted onboarding and support
- ✅ Arabic and English bilingual UI

## What's NOT Promised

- ❌ Statutory payroll (taxes, social insurance)
- ❌ Automated salary payment
- ❌ Automated payment gateway
- ❌ WhatsApp/email notifications (coming soon)
- ❌ AI disciplinary decisions (demo mode only)
- ❌ Public permanent document storage

## Known Limitations

1. **Browser QA not performed** — Arabic/English screenshots not reviewed (requires browser automation)
2. **No automated tests** — No unit, integration, or E2E tests exist yet
3. **In-memory rate limiting** — Per-Vercel-function-instance, not global
4. **PIN stored in plaintext** — Migration to pinHash planned for post-pilot
5. **No session revocation** — JWT-only architecture, stolen tokens remain valid until expiry
6. **Vercel project link changed** — Needs re-linking to original project

## Deployment

- **Production URL:** https://b-attend.vercel.app
- **Release branch:** `release/sell-ready-pilot`
- **Latest commit:** `dabcbf1`

## Rollback Instructions

```bash
git checkout main
git push origin main --force  # if needed
# Or deploy previous Vercel deployment via dashboard
```

## Recommendation: **GO** for Founding Customer Pilot

All P0 security fixes are implemented. The application is suitable for a controlled pilot with founding customers who understand this is an assisted-pilot release. Browser QA screenshots should be captured before general availability.
