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

---

## 26. B-Coach AI module

### Employee coach page (`/coach`)
- [ ] Employee can access `/coach` and see only their own coaching data
- [ ] Employee cannot access another employee's coach data (test via direct API call with another employeeId → 403)
- [ ] Daily motivation card renders at top with title + body
- [ ] Consistency score (0-100) displays with correct level
- [ ] Positive signals list shows strengths (perfect attendance, on-time, etc.)
- [ ] Development areas list shows improvement items (never shaming)
- [ ] This week summary shows real attendance stats from AttendanceDay
- [ ] This month summary shows real attendance stats
- [ ] My strengths card shows supportive positive summary
- [ ] Development areas card shows improvement + practical advice
- [ ] Suggested action for tomorrow shows one concrete step
- [ ] Progress streak counts consecutive on-time days
- [ ] Recent achievements list shows on-time arrivals and overtime
- [ ] Development tips show 6 tips from coach library

### Manager team coach (`/team-coach`)
- [ ] Owner/HR can access `/team-coach`
- [ ] Branch Manager can access `/team-coach` but sees only their branch
- [ ] Employee cannot access `/team-coach` (forbidden message)
- [ ] Team coaching overview shows summary with stats
- [ ] Employees needing attention list shows reason + suggested action
- [ ] Employees improving list shows trend
- [ ] Strong consistency list shows top employees by score
- [ ] Suggested manager actions are numbered and actionable
- [ ] Daily briefing preview shows short text
- [ ] No private employee notes exposed to other employees

### Daily briefing (`/daily-briefing`)
- [ ] Manager/HR/Owner can access
- [ ] Employee cannot access (forbidden)
- [ ] Today's focus theme displays
- [ ] 3 talking points render as numbered list
- [ ] Operational reminder displays
- [ ] Motivation paragraph displays
- [ ] Branch note displays (if branch-scoped)
- [ ] Shows upgrade prompt if plan does not include daily_briefing

### Coach library (`/coach-library`)
- [ ] Owner/HR can access
- [ ] Employee cannot access (forbidden)
- [ ] Custom tips list shows tenant-specific tips
- [ ] System default tips list shows 30 system tips
- [ ] Add custom tip form validates required fields
- [ ] Newly created tip appears in custom list
- [ ] Activate/deactivate toggle works
- [ ] Delete custom tip works (only custom, not system)

### Super Admin AI controls (`/admin/ai`)
- [ ] Super Admin can access
- [ ] Other platform roles (SALES_ADMIN, SUPPORT_AGENT, BILLING_ADMIN) cannot access
- [ ] Global AI settings form saves correctly
- [ ] Toggle AI module globally disables all AI features for all tenants
- [ ] Per-tenant AI toggle works (enable/disable per tenant)
- [ ] AI usage logs table shows latest 50 entries
- [ ] Feature usage by type shows counts per feature

### Super Admin coach library (`/admin/coach-library`)
- [ ] Super Admin can access
- [ ] System tips list shows all 30 seeded tips
- [ ] Add new system tip works
- [ ] Activate/deactivate system tip works
- [ ] Delete system tip works

### Daily motivation
- [ ] Daily motivation appears on `/coach` for employees
- [ ] Content is short, practical, friendly, work-focused
- [ ] No religious, political, medical, or sensitive claims
- [ ] No fake quotes from real people
- [ ] Same date shows same content (deterministic)
- [ ] Different dates may show different themes

### Coach summary uses real data
- [ ] Summary reflects actual AttendanceDay records
- [ ] Late count matches `exceptionFlags` containing "LATE"
- [ ] Absent count matches status="ABSENT"
- [ ] Missing clock-out count matches status="MISSING_CLOCK_OUT"
- [ ] Outside geofence count matches exceptionFlags containing "OUTSIDE_GEOFENCE"
- [ ] Overtime minutes match `overtimeMinutes` sum
- [ ] Improvement trend compares to previous period
- [ ] No static fake operational data anywhere

### Consistency score
- [ ] Score starts at 100
- [ ] Deductions: -8 per absent day, -3 per late day (cap 20), -2 per missing clock-out (cap 10), -3 per outside geofence (cap 15)
- [ ] Bonuses: +5 perfect attendance, +5 no late arrivals
- [ ] Score clamped 0-100
- [ ] Level thresholds: 90+ EXCELLENT, 75+ GOOD, 55+ NEEDS_ATTENTION, <55 NEEDS_SUPPORT
- [ ] Explanation lists positive signals + improvement signals
- [ ] Never uses shaming wording

### AI mock provider
- [ ] App runs without `OPENAI_API_KEY` set
- [ ] `AI_PROVIDER=mock` (or unset) uses templates
- [ ] No crash if AI key missing
- [ ] Every AI call logs to `AiUsageLog` with provider=MOCK
- [ ] Daily motivation is deterministic for same date

### Feature gates
- [ ] Trial plan: only daily_motivation available
- [ ] Starter plan: daily_motivation + ai_coach
- [ ] Growth plan: ai_coach + daily_motivation + manager_ai_insights + coach_library
- [ ] Pro plan: all features + daily_briefing
- [ ] Enterprise plan: all features
- [ ] Plans without AI feature show upgrade prompt (not crash)
- [ ] Attendance data is never hidden — only AI coaching is gated
- [ ] Super Admin global disable overrides plan
- [ ] Per-tenant disable overrides plan

### Privacy and compliance
- [ ] AI uses attendance and scheduling data only
- [ ] No medical/psychological/political/religious inferences
- [ ] No punishment recommendations
- [ ] No termination recommendations
- [ ] Employee A cannot see employee B's coach data
- [ ] Employee-facing tone is supportive and constructive
- [ ] Manager-facing tone is factual and operational
- [ ] No "bad employee", "lazy", "unreliable", or "problematic" wording

### Audit and usage logs
- [ ] Every AI call creates `AiUsageLog` entry
- [ ] Logs include companyId, userId, feature, provider, status
- [ ] Failed AI calls logged with errorMessage
- [ ] Super Admin can view logs in `/admin/ai`
- [ ] Logs filterable by feature

### API endpoints
- [ ] `GET /api/coach/employee-summary?employeeId=...` returns coach summary JSON
- [ ] `GET /api/coach/team-summary?branchId=...` returns team insights JSON
- [ ] `GET /api/coach/daily-content?date=...` returns daily motivation JSON
- [ ] `GET /api/coach/tips?theme=...` returns tips JSON
- [ ] `GET /api/admin/ai/settings` returns global AI settings (Super Admin only)
- [ ] `POST /api/admin/ai/settings` updates global AI settings (Super Admin only)
- [ ] `GET /api/admin/ai/usage` returns AI usage logs (platform users only)
- [ ] All tenant endpoints enforce companyId scoping
- [ ] Employee endpoints enforce self-only access

### Notifications
- [ ] Daily motivation available notification created
- [ ] Weekly coach summary ready notification created
- [ ] Manager team insights ready notification created
- [ ] Notifications visible in header bell (placeholder UI)
