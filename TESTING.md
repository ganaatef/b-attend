# B-Attend — Testing Checklist

Manual test checklist for B-Attend. Run through each section before releasing changes.

---

## 1. Auth

- [ ] `/login` with valid platform credentials → redirects to `/admin`
- [ ] `/login` with valid tenant credentials → redirects to `/dashboard`
- [ ] `/login` with invalid credentials → shows "Invalid email or password"
- [ ] `/login` with empty fields → shows validation errors
- [ ] `POST /api/auth/logout` destroys session, redirects to `/login`
- [ ] Session cookie is HttpOnly + SameSite=Lax
- [ ] Session expires after 7 days
- [ ] Password is bcrypt-hashed (check `PlatformUser.passwordHash` and `User.passwordHash` in DB)
- [ ] Login creates `PlatformAuditLog` entry with action=LOGIN
- [ ] Failed login does NOT create audit log (no info leak)

## 2. Tenant isolation

- [ ] Tenant A user cannot access Tenant B's data via API
- [ ] Branch Manager sees only their assigned branch in `/employees`, `/schedules`, `/live`, `/approvals`, `/reports`
- [ ] Employee sees only their own data in `/today`, `/attendance`, `/requests`, `/profile`
- [ ] Super Admin can see all tenants via `/admin/tenants`
- [ ] Every tenant query filters by `companyId`
- [ ] `getTenantId()` throws if session is not a tenant session
- [ ] Direct URL access to other tenants' resources returns 404 (e.g. `/employees/[other-tenant-employee-id]`)

## 3. Subscription gating

- [ ] PENDING_ACTIVATION tenant sees "account being reviewed" screen, cannot access `/dashboard`
- [ ] ACTIVE tenant can access all operational pages
- [ ] SUSPENDED tenant sees suspended banner, can only access `/billing` and `/support`
- [ ] CANCELLED tenant is read-only
- [ ] REJECTED tenant sees rejection screen
- [ ] Trial banner shows "X days remaining" when TRIALING
- [ ] Subscription status changes by Super Admin reflect immediately in tenant UI

## 4. Plan limits

- [ ] Creating a branch beyond `plan.maxBranches` returns clear error
- [ ] Creating an employee beyond `plan.maxEmployees` returns clear error
- [ ] Plan limits can be overridden by Super Admin editing the plan in `/admin/plans/[id]`
- [ ] Plan usage bars in `/billing` reflect actual counts
- [ ] Feature flags (PlanFeature) toggle correctly when edited by Super Admin

## 5. Super Admin

- [ ] `/admin` shows DB-backed metrics (no static numbers)
- [ ] `/admin/tenants` filter by status works
- [ ] Activate Trial / Activate Paid / Suspend / Reactivate / Cancel / Reject all work
- [ ] Impersonation requires reason (min 5 chars) and creates audit log
- [ ] Impersonation logs the impersonator in to the tenant owner account
- [ ] `/admin/plans/[id]` editing updates plan + features
- [ ] `/admin/invoices` mark-paid creates a Payment row
- [ ] `/admin/invoices` void works
- [ ] `/admin/leads` status change + assignment works
- [ ] `/admin/support/[id]` reply updates ticket status
- [ ] `/admin/settings` save updates SystemSetting singleton
- [ ] `/admin/audit` filter by action works
- [ ] `/admin/system` shows DB connection status

## 6. Signup

- [ ] `/signup` validates all required fields
- [ ] Duplicate email returns clear error
- [ ] Submit creates: Tenant (PENDING_ACTIVATION) + Subscription (PENDING_PAYMENT or TRIALING) + Lead
- [ ] Audit log entries created
- [ ] Pending activation screen shows after submit
- [ ] Lead appears in `/admin/leads` for Super Admin

## 7. Activation

- [ ] Super Admin can activate pending tenants
- [ ] After activation, tenant owner can log in and see `/dashboard`
- [ ] Trial activation sets `trialEndsAt` to now + 14 days
- [ ] Paid activation sets subscription status to ACTIVE

## 8. Billing

- [ ] `/billing` shows current plan, subscription status, billing cycle
- [ ] Plan usage bars are accurate
- [ ] Invoice list shows all invoices for the tenant
- [ ] Invoice statuses display correctly (DRAFT, ISSUED, PENDING_PAYMENT, PAID, OVERDUE, VOID, REFUNDED)
- [ ] Super Admin can create manual invoice from `/admin/tenants/[id]`
- [ ] Super Admin can mark invoice paid (creates Payment row)
- [ ] Super Admin can void invoice

## 9. Branches

- [ ] `/branches` list shows all branches with employee/schedule counts
- [ ] Create branch form validates required fields
- [ ] Geofence radius is between 50 and 2000
- [ ] Plan limit enforced on create
- [ ] `/branches/[id]` shows branch detail + employees
- [ ] Soft-delete (archived) branches disappear from list

## 10. Employees

- [ ] `/employees` list shows all active employees
- [ ] Quick-add form validates required fields
- [ ] Employee code unique per company
- [ ] Plan limit enforced on create
- [ ] `/employees/[id]` shows profile with month summary, recent punches, requests
- [ ] Soft-delete (LEFT) employees disappear from list
- [ ] Employee linked to user via `userId` can log in

## 11. Schedules

- [ ] `/schedules` shows today's schedules by default
- [ ] Date navigation (prev/next) works
- [ ] Single schedule create validates employee/branch/policy/date
- [ ] Duplicate employee/date schedule returns clear error
- [ ] Bulk generate: select branch + employees + date range + policy + weekend days
- [ ] Bulk generate skips weekends (Fri/Sat by default)
- [ ] Bulk generate skips existing duplicates
- [ ] Bulk generate returns created count + skipped count
- [ ] Overnight shifts (e.g. 17:00 → 01:00) calculate expectedEnd on next day

## 12. Clock in/out

- [ ] `/clock` shows employee info + today's shift + last punch
- [ ] Clock In button requests geolocation permission
- [ ] Geolocation denied → friendly error + "submit manual request" prompt
- [ ] Inside geofence → punch ACCEPTED, AttendanceDay recalculated
- [ ] Outside geofence → punch NEEDS_APPROVAL, status=OUTSIDE_GEOFENCE
- [ ] Distance in meters saved on punch
- [ ] Cannot clock in twice in a row (error: "Already clocked in")
- [ ] Cannot clock out without clock in (error: "Cannot clock out without clocking in first")
- [ ] Inactive employee cannot clock
- [ ] Employee can only clock for themselves

## 13. Kiosk

- [ ] `/kiosk` shows branch selector + code/PIN input
- [ ] Lookup by employee code works
- [ ] Lookup by PIN works
- [ ] Unknown code/PIN returns "Employee not found"
- [ ] Shows employee name, code, branch, today's shift
- [ ] Shows next action (Clock In vs Clock Out based on last punch)
- [ ] Clock action assumes inside geofence (distance=0, source=KIOSK)
- [ ] Success state auto-resets after 2.5 seconds

## 14. Geofence

- [ ] Haversine distance calculates correctly (test with known coordinates)
- [ ] Inside/outside geofence determined by `distanceMeters <= geofenceRadius`
- [ ] Branch with no coordinates → all punches accepted (no geofence check)
- [ ] Outside-geofence punch creates ApprovalRequest automatically
- [ ] Approval of outside-geofence request marks punch as ACCEPTED (does not erase distance data)

## 15. Attendance engine

- [ ] `recalculateAttendanceDay` correctly identifies ON_TIME / LATE / EARLY_LEAVE / OVERTIME / MISSING_CLOCK_OUT / OUTSIDE_GEOFENCE / ABSENT / NO_SCHEDULE / OFF / LEAVE
- [ ] Late = clockIn > expectedStart + lateGraceMinutes
- [ ] Early leave = clockOut < expectedEnd - earlyLeaveGraceMinutes
- [ ] Overtime = workedMinutes > overtimeStartsAfterMinutes
- [ ] Missing clock out = clockIn exists, no clockOut, day passed
- [ ] Absent = scheduled, no clockIn, day passed
- [ ] Off = schedule.status=OFF, never ABSENT
- [ ] Leave = schedule.status=LEAVE
- [ ] No schedule + punch exists → NO_SCHEDULE, requires approval
- [ ] Multiple exceptions preserved in exceptionFlags JSON
- [ ] Primary status + exception flags both saved
- [ ] `markAbsentForPastScheduledDays` skips OFF, LEAVE, existing AttendanceDay, employees with any punch
- [ ] `POST /api/system/mark-absent` works for Super Admin (all companies) and tenant admin (own company only)

## 16. Approvals

- [ ] Employee can submit 8 request types (MANUAL_CLOCK_IN, MANUAL_CLOCK_OUT, OUTSIDE_GEOFENCE, MISSING_CLOCK_OUT, OVERTIME, ATTENDANCE_ADJUSTMENT, LEAVE_REQUEST, PERMISSION_REQUEST)
- [ ] Manager/HR sees pending approvals in `/approvals`
- [ ] Branch manager sees only their branch's approvals
- [ ] Approve → side effect:
  - MANUAL_CLOCK_IN → creates manual Punch CLOCK_IN + recalc
  - MANUAL_CLOCK_OUT / MISSING_CLOCK_OUT → creates manual Punch CLOCK_OUT + recalc
  - OUTSIDE_GEOFENCE → marks linked punch ACCEPTED + recalc
  - LEAVE_REQUEST → marks schedule LEAVE + upserts AttendanceDay LEAVE
- [ ] Reject → no data changes, only request status + notes
- [ ] Cancel → request status = CANCELLED
- [ ] All decisions audit-logged

## 17. Reports

- [ ] `/reports` shows 6 report types
- [ ] Date range filter works
- [ ] Branch filter works
- [ ] Branch manager sees only their branch in filter dropdown
- [ ] Employees cannot access `/reports` (403)
- [ ] CSV export downloads with proper filename
- [ ] CSV has UTF-8 BOM (`\uFEFF`)
- [ ] CSV escapes quotes, commas, newlines correctly
- [ ] Daily report: one row per employee per day
- [ ] Monthly report: per-employee totals
- [ ] Exceptions report: only rows requiring attention
- [ ] Overtime report: only rows with overtimeMinutes > 0 (even after approval)
- [ ] Branch report: grouped by branch
- [ ] Payroll export: per-employee summary
- [ ] Export logged in ReportExportLog + AuditLog

## 18. CSV

- [ ] Open exported CSV in Excel → Arabic characters render correctly (BOM)
- [ ] Open in Google Sheets → all columns parse correctly
- [ ] No data leakage across tenants
- [ ] Filename includes prefix + date range

## 19. Audit

- [ ] Tenant audit log (`/audit`) only visible to owner/HR
- [ ] Platform audit log (`/admin/audit`) only visible to platform users
- [ ] All important actions logged: LOGIN, LOGOUT, EMPLOYEE_CREATED, BRANCH_CREATED, SCHEDULE_CREATED, SCHEDULE_GENERATED, CLOCK_IN, CLOCK_OUT, APPROVAL_SUBMITTED, APPROVAL_APPROVED, APPROVAL_REJECTED, SETTINGS_UPDATED, REPORT_EXPORTED, CSV_EXPORTED, PLAN_CHANGED, SUBSCRIPTION_ACTIVATED, SUBSCRIPTION_SUSPENDED, INVOICE_CREATED, PAYMENT_RECORDED, TENANT_IMPERSONATED
- [ ] Audit log shows actor email, action, entity, reason, timestamp
- [ ] Filter by action works

## 20. Settings

- [ ] Customer settings save validates all fields
- [ ] Geofence radius between 50 and 2000
- [ ] Grace minutes between 0 and 120
- [ ] Overtime threshold between 0 and 1440
- [ ] Toggles save correctly (mobile clock, kiosk, approval rules, etc.)
- [ ] "Run mark-absent" maintenance action works
- [ ] Super Admin settings (`/admin/settings`) save works
- [ ] Settings changes audit-logged

## 21. Support

- [ ] Customer can submit ticket with subject/category/priority/message
- [ ] Ticket appears in customer's `/support` list
- [ ] Ticket appears in Super Admin's `/admin/support` queue
- [ ] Customer can reply to their own ticket
- [ ] Super Admin can reply (with optional internal note checkbox)
- [ ] Reply updates ticket status to WAITING_CUSTOMER
- [ ] Super Admin can change ticket status (IN_PROGRESS, RESOLVED, CLOSED)
- [ ] Messages display in chronological order
- [ ] Internal notes highlighted differently

## 22. Mobile responsiveness

- [ ] Landing page renders cleanly at 375px (iPhone SE)
- [ ] Landing page renders cleanly at 768px (iPad)
- [ ] Landing page renders cleanly at 1280px (desktop)
- [ ] Sidebar collapses to mobile bottom nav at <md
- [ ] Tables scroll horizontally on mobile
- [ ] Forms stack vertically on mobile
- [ ] Touch targets are at least 44px
- [ ] Footer is sticky at bottom on short pages
- [ ] Footer is pushed down on long pages (no overlap)

## 23. Error states

- [ ] 404 page renders for unknown routes
- [ ] Server errors show generic error page (no stack trace to user)
- [ ] Database errors are logged but not exposed to user
- [ ] Form validation errors show inline
- [ ] Empty states render when no data (EmptyState component)
- [ ] Loading skeletons during async operations
- [ ] Network errors show retry option

## 24. Security access control

- [ ] Unauthenticated user cannot access `/admin/*` or tenant routes
- [ ] Tenant user cannot access `/admin/*`
- [ ] Platform user cannot access `/dashboard` etc. (redirected to `/admin`)
- [ ] Employee cannot access `/admin`, `/dashboard`, `/employees`, `/branches`, `/schedules`, `/approvals`, `/reports`, `/audit`, `/settings`, `/billing`, `/users`
- [ ] Branch Manager cannot access `/settings`, `/billing`, `/users` (owner/HR only)
- [ ] HR Admin cannot change billing (but can view)
- [ ] All Server Actions enforce role checks
- [ ] All API routes enforce session checks
- [ ] IDs in URLs are validated against tenant scope
- [ ] No secrets in client-side code
- [ ] No passwords logged

## 25. Build & typecheck

- [ ] `bun run lint` passes with 0 errors
- [ ] `bunx tsc --noEmit` passes (run before deploy)
- [ ] `bun run build` succeeds (production build)
- [ ] No runtime crashes on main flows (smoke test all routes)
