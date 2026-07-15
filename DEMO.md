# B-Attend — Demo Flows

This document walks through the four main demo personas. All accounts use password `demo1234`.

---

## 1. Super Admin demo

**Login**: `super@b-attend.app` / `demo1234` → redirects to `/admin`

### Dashboard
- See DB-backed metrics: total companies, pending activations, MRR/ARR, pending invoices, open tickets, clock actions today, total employees across tenants.
- Recent tenants list, recent leads list, recent invoices, recent tickets.

### Tenants
1. Go to `/admin/tenants`
2. Filter by status (PENDING_ACTIVATION, ACTIVE, SUSPENDED, etc.)
3. Click the demo tenant `B-Attend Demo Restaurant Group`
4. On detail page:
   - See usage stats (3 branches, 15 employees, plan limits)
   - See recent employees, invoices, audit log
   - Try "Change plan" form (select a different plan, save)
   - Try "Create manual invoice" form (enter amounts, due date, save)
   - Try "Impersonate Owner" with reason "Customer support" — you'll be logged in as the tenant owner

### Invoices
1. Go to `/admin/invoices`
2. Filter by status (PENDING_PAYMENT, OVERDUE, PAID)
3. Find a pending invoice → select payment method → "Mark paid"
4. Verify the invoice moves to PAID and a Payment row is created

### Leads
1. Go to `/admin/leads`
2. See 3 demo leads (Ahmed Mansour / Mona Adel / Khaled Sami)
3. Change status of a lead (NEW → CONTACTED → QUALIFIED → WON)
4. Assign a lead to a sales admin

### Plans
1. Go to `/admin/plans`
2. Click "Growth" plan → edit page
3. Change maxEmployees from 75 to 100 → save
4. Toggle a feature flag (e.g. enable `api_access`)

### Audit
1. Go to `/admin/audit`
2. Filter by action (LOGIN, SUBSCRIPTION_ACTIVATED, INVOICE_CREATED, etc.)
3. See your own actions from this demo session

### System
1. Go to `/admin/system`
2. Verify DB connection is operational, see env vars, record counts

---

## 2. Customer Owner demo

**Login**: `owner@b-attend.app` / `demo1234` → redirects to `/dashboard`

### Dashboard
- See company stats: active employees (15), branches (3), scheduled today, clock actions today, pending approvals (2)
- Recent outside-geofence punches
- Quick links to live attendance, employees, schedules, reports

### Onboarding
1. Go to `/onboarding`
2. See the 7-step wizard with progress checklist
3. Each tab is functional: profile, branch, departments, policies, employees, schedules, review

### Branches
1. Go to `/branches`
2. See 3 branches (New Cairo, Nasr City, Maadi) with employee counts and geofence info
3. Try adding a 4th branch — should be blocked with plan limit message (Growth plan = 3 branches)
4. Click a branch → see employees at that branch

### Employees
1. Go to `/employees`
2. See 15 employees with code, name, branch, department, status
3. Use the quick-add form to add a new employee
4. Click an employee → see profile with month summary, recent punches, recent requests

### Schedules
1. Go to `/schedules`
2. Use date picker to navigate days
3. Try "Bulk generate" link → select branch + employees + date range + policy → generate
4. Verify created count + skipped duplicates

### Live attendance
1. Go to `/live`
2. See today's stats (scheduled, present, late, absent, missing clock-out, outside geofence)
3. See recent punches feed with geofence status

### Kiosk
1. Go to `/kiosk`
2. Select branch (New Cairo)
3. Enter employee code `EMP001` or PIN `1000`
4. See employee info + today's shift
5. Click "Clock In" — punch is recorded with source=KIOSK

### Approvals
1. Go to `/approvals`
2. See 2 pending approval requests (outside geofence + overtime)
3. Click a request → see details + punches on that date
4. Approve or reject with notes
5. Verify the side effect (e.g. OUTSIDE_GEOFENCE approval marks punch as ACCEPTED)

### Reports
1. Go to `/reports`
2. Set date range (default: current month)
3. Try each of the 6 report types:
   - Daily Attendance — one row per employee per day
   - Monthly Summary — per-employee totals
   - Exceptions — only rows requiring attention
   - Overtime — rows where overtimeMinutes > 0
   - Branch Attendance — grouped by branch
   - Payroll Export — payroll-ready summary
4. Click "Export CSV" — file downloads with UTF-8 BOM (open in Excel, Arabic-compatible)

### Billing
1. Go to `/billing`
2. See current plan (Growth), subscription status (ACTIVE), billing cycle
3. See plan usage bars (branches 3/3, employees 15/75, etc.)
4. See invoices table (1 paid, 1 pending, 1 overdue)

### Settings
1. Go to `/settings`
2. Edit company settings (geofence radius, grace minutes, overtime threshold, toggles)
3. Save → verify audit log entry in `/audit`
4. Try "Run mark-absent" maintenance action

### Support
1. Go to `/support`
2. See existing ticket (already seeded)
3. Submit a new ticket with subject + category + priority + message
4. Click into the ticket → reply

### Users
1. Go to `/users`
2. See 5 tenant users (owner, hr, manager, manager2, employee)
3. Invite a new user (HR Admin) → see temp password generated
4. (Logout, login with temp password — forced to change)

---

## 3. Employee demo

**Login**: `employee@b-attend.app` / `demo1234` → redirects to `/today`

### Today page
- See greeting, today's shift (Morning 08:00 → 16:00)
- See last action (clocked in/out)
- Big "Clock In" or "Clock Out" button
- Month stats: present days, absent days, late minutes, worked hours
- Pending requests alert
- Quick links: My attendance, My requests

### Clock in/out
1. Click "Clock In" → browser asks for location permission
2. Allow → location captured, distance from branch calculated
3. If inside geofence: punch ACCEPTED, AttendanceDay recalculated
4. If outside geofence: punch NEEDS_APPROVAL, request auto-created for manager

### My attendance
1. Go to `/attendance`
2. See current month's attendance days with status badges
3. Click any day to see punches (via employee detail page)

### My requests
1. Go to `/requests`
2. Submit a new request (e.g. "Forgot Clock In" with requested time + reason)
3. See request status (PENDING → APPROVED/REJECTED)
4. See manager notes if rejected

### Profile
1. Go to `/profile`
2. See account info + linked employee record (code, job title, branch, department)

---

## 4. Branch Manager demo

**Login**: `manager@b-attend.app` / `demo1234` → redirects to `/dashboard`

### Branch-scoped access
- Dashboard shows only New Cairo branch stats
- `/live` shows only New Cairo punches
- `/employees` shows only New Cairo employees
- `/schedules` shows only New Cairo schedules
- `/approvals` shows only New Cairo approval requests
- `/reports` exports only New Cairo data
- Cannot access `/settings` or `/billing` (owner/HR only)

### Kiosk
1. Go to `/kiosk`
2. Branch defaults to New Cairo (only managed branch)
3. Look up employees by code/PIN
4. Clock them in/out

---

## 5. Billing demo (suspended account behavior)

1. Login as `super@b-attend.app`
2. Go to `/admin/tenants/[demo-tenant-id]`
3. Click "Suspend" with reason "Test suspension"
4. Verify tenant status changes to SUSPENDED
5. Logout, login as `owner@b-attend.app`
6. Subscription banner shows "Account suspended"
7. Operational pages (clock, dashboard, etc.) are blocked
8. `/billing` and `/support` are still accessible
9. (Log back in as super admin, reactivate the tenant)

---

## 6. Signup → Activation flow

1. Go to `/signup`
2. Fill the form with a new company
3. Submit → see "Your account is being reviewed" screen
4. Login as `super@b-attend.app`
5. Go to `/admin/tenants` → filter by PENDING_ACTIVATION
6. Find the new tenant → click "Activate Trial" or "Activate Paid"
7. Logout, login as the new tenant owner (using the email/password from signup)
8. Now see the onboarding wizard at `/onboarding`

---

## Quick smoke test

```bash
# Public pages (should all return 200)
for p in / /pricing /features /contact /request-demo /signup /login /legal/privacy /legal/terms; do
  curl -s -o /dev/null -w "${p} -> %{http_code}\n" "http://localhost:3000${p}"
done

# Protected pages (should all redirect to /login with 307)
for p in /admin /dashboard /onboarding /branches /employees /clock /kiosk /reports /billing; do
  curl -s -o /dev/null -w "${p} -> %{http_code}\n" "http://localhost:3000${p}"
done

# API endpoints
curl -s -o /dev/null -w "POST /api/auth/logout -> %{http_code}\n" -X POST http://localhost:3000/api/auth/logout
curl -s "http://localhost:3000/api/public/plans" | head -c 200
```

Expected: all public pages 200, all protected 307, logout 200, plans API returns JSON.

---

## 7. B-Coach AI Module demo

The B-Coach AI module is a supportive, development-oriented staff coach. It uses real attendance data and never recommends punishment.

### Employee Coach AI demo

**Login**: `employee@b-attend.app` / `demo1234` → visit `/coach`

1. See your **daily motivation** at the top — a short, practical paragraph for the day.
2. See your **consistency score** (0-100) with level (EXCELLENT / GOOD / NEEDS_ATTENTION / NEEDS_SUPPORT). The score is for coaching only — it does not affect salary or HR decisions.
3. See **positive signals** (perfect attendance, on-time, extra effort, improving) and **development areas** (late, missing clock-out, etc.).
4. See **this week** and **this month** summaries with real attendance stats.
5. See **My strengths** card with a supportive, personalized summary.
6. See **Development areas** card with practical advice — never shaming.
7. See **Suggested action for tomorrow** — one concrete step.
8. See **My progress streak** — consecutive on-time days.
9. See **Recent achievements** — on-time arrivals, overtime effort.
10. See **Development tips** — short practical tips from the coach library.

### Manager Team Coach AI demo

**Login**: `owner@b-attend.app` / `demo1234` → visit `/team-coach`

1. See **team coaching overview** — summary with stats (need support / improving / top consistency counts).
2. See **Employees needing attention** — list with reason (late arrivals, missing clock-out, etc.) and suggested coaching action.
3. See **Employees improving** — list of those showing positive trend.
4. See **Strong consistency** — top employees by score.
5. See **Suggested manager actions** — numbered list of coaching actions.
6. See **Daily team briefing preview** — short text to read at shift start.

> Manager insights are factual and based on attendance records. They never recommend termination or disciplinary action.

### Daily Briefing demo

**Login**: `owner@b-attend.app` / `demo1234` → visit `/daily-briefing`

> Note: Daily briefing requires the Pro plan. The demo tenant is on Growth, so you'll see an upgrade prompt. To test it, switch the demo tenant to Pro via `/admin/tenants/[id]` → Change plan.

When available, the briefing includes:
1. **Today's focus theme** (e.g. Punctuality, Teamwork, Cleanliness).
2. **3 talking points** to read to the team.
3. **Operational reminder** (e.g. "Clock in only when you are at the branch and ready to work").
4. **Motivation paragraph** — short, practical, work-focused.
5. Optional **branch note**.

### Coach Library demo

**Login**: `owner@b-attend.app` / `demo1234` → visit `/coach-library`

1. See your **custom tips** (initially empty — add one with the form).
2. See **system default tips** (30 pre-seeded tips across 10 themes).
3. Add a custom tip — title, body, theme, target audience, language.
4. Activate/deactivate custom tips.
5. Delete custom tips.

### Super Admin AI Controls demo

**Login**: `super@b-attend.app` / `demo1234` → visit `/admin/ai`

1. **Global AI settings** — toggle AI module on/off, switch provider (MOCK / OPENAI), toggle daily coach + employee insights.
2. **Per-tenant AI status** — see all tenants, enable/disable AI per tenant.
3. **AI usage logs** — latest 50 calls with tenant, feature, provider, status.
4. **AI feature usage by type** — counts per feature.

### Super Admin Coach Tips demo

**Login**: `super@b-attend.app` / `demo1234` → visit `/admin/coach-library`

1. See all 30 system default tips.
2. Add a new system tip.
3. Activate/deactivate system tips.
4. Delete system tips.

### Feature gate demo

1. Login as `super@b-attend.app`.
2. Go to `/admin/tenants/[demo-tenant-id]` → Change plan → "Trial".
3. Logout, login as `owner@b-attend.app`.
4. Visit `/coach` → you'll see daily motivation (Trial includes daily_motivation) but no AI coach summary (Trial does not include ai_coach).
5. Visit `/team-coach` → upgrade prompt (Trial does not include manager_ai_insights).
6. Visit `/daily-briefing` → upgrade prompt (Pro+ only).
7. (Switch the demo tenant back to Growth after testing.)

---

## 8. HR-4: Warnings, Training, Assets, Onboarding, Offboarding demo

The HR-4 module covers employee warnings management, training courses and assignments, company assets and uniforms, onboarding checklists, and offboarding workflows.

### Warnings demo flow

**Login**: `hr@b-attend.app` / `demo1234` → redirects to `/dashboard`

1. Go to `/warnings`
2. See list of existing warnings (if any) with status badges
3. Click "Create Warning" → fill in employee, category, severity, description, notes
4. Submit → warning created with status PENDING
5. Switch to employee login (`employee@b-attend.app`) → visit `/self-service/warnings`
6. See pending warning → click "Acknowledge" → status changes to ACKNOWLEDGED
7. Switch back to HR login → see warning status updated
8. Click "Resolve" on the warning → add resolution notes → status changes to RESOLVED
9. Verify warning appears in employee's resolved warnings list
10. Verify audit log entry for each action (created, acknowledged, resolved)

### Training demo flow

**Login**: `hr@b-attend.app` / `demo1234` → redirects to `/dashboard`

1. Go to `/training`
2. See list of training courses (initially empty)
3. Click "Create Course" → fill in title, description, due date, passing score
4. Submit → course created
5. Go to `/training/assignments` → assign course to an employee or branch
6. Switch to employee login (`employee@b-attend.app`) → visit `/self-service/training`
7. See assigned course → click "Start Course" → status changes to IN_PROGRESS
8. Complete the course → mark as completed
9. Status changes to COMPLETED with completion date
10. Switch back to HR login → see completion status in training reports
11. Verify overdue status for past-due assignments
12. Export training report to Excel → verify CSV downloads with correct data

### Assets demo flow

**Login**: `hr@b-attend.app` / `demo1234` → redirects to `/dashboard`

1. Go to `/assets`
2. See list of company assets (initially empty)
3. Click "Add Asset" → fill in name, category (LAPTOP, PHONE, UNIFORM, EQUIPMENT), serial number, condition
4. Submit → asset created with status AVAILABLE
5. Go to `/assets/assignments` → assign asset to an employee with expected return date
6. Asset status changes to ASSIGNED
7. Switch to employee login (`employee@b-attend.app`) → visit `/self-service/assets`
8. See assigned asset with details and expected return date
9. Switch back to HR login → process return
10. Click "Return" on the assignment → add return condition notes → status changes to RETURNED
11. Asset status changes back to AVAILABLE
12. Export assets report to Excel → verify CSV downloads with correct data

### Onboarding demo flow

**Login**: `hr@b-attend.app` / `demo1234` → redirects to `/dashboard`

1. Go to `/onboarding-checklists`
2. See list of onboarding checklists (initially empty)
3. Click "Create Checklist" → fill in title, description, add tasks (document submission, equipment setup, orientation, training)
4. Submit → checklist created with status IN_PROGRESS
5. Assign checklist to a new employee
6. Switch to employee login (`employee@b-attend.app`) → visit `/self-service/onboarding`
7. See assigned checklist with task list
8. Complete tasks one by one → each task marked as DONE
9. All tasks complete → checklist status changes to COMPLETED
10. Switch back to HR login → see completion status in onboarding reports
11. Export onboarding report to Excel → verify CSV downloads with correct data

### Offboarding demo flow

**Login**: `hr@b-attend.app` / `demo1234` → redirects to `/dashboard`

1. Go to `/offboarding`
2. See list of offboarding processes (initially empty)
3. Click "Start Offboarding" → select employee, fill in reason, last working day
4. Submit → offboarding created with status IN_PROGRESS, tasks auto-generated (exit interview, equipment return, access revocation, knowledge transfer)
5. Manager/HR completes tasks one by one → each task marked as DONE
6. All tasks complete → status changes to COMPLETED
7. Employee status updated to reflect departure
8. Export offboarding report to Excel → verify CSV downloads with correct data

### Employee self-service demo

**Login**: `employee@b-attend.app` / `demo1234` → redirects to `/today`

1. Go to `/self-service/training` → see assigned courses, completion status, due dates
2. Go to `/self-service/assets` → see assigned assets, return dates, condition
3. Go to `/self-service/onboarding` → see onboarding checklist, complete tasks
4. Go to `/self-service/offboarding` → see offboarding tasks (if applicable)
5. Go to `/self-service/warnings` → see warnings, acknowledge pending ones
6. Verify each page only shows data for the logged-in employee
7. Verify branch-scoped data visibility

### Excel export demo for each module

1. Login as `hr@b-attend.app` → visit `/warnings` → click "Export Excel"
2. Verify warnings CSV downloads with columns: employee, category, severity, status, date created, date resolved
3. Visit `/training` → click "Export Excel"
4. Verify training CSV downloads with columns: course title, assigned employee, status, completion date, due date
5. Visit `/assets` → click "Export Excel"
6. Verify assets CSV downloads with columns: asset name, category, serial, assigned employee, status, assignment date
7. Visit `/onboarding-checklists` → click "Export Excel"
8. Verify onboarding CSV downloads with columns: checklist title, employee, status, tasks completed, total tasks
9. Visit `/offboarding` → click "Export Excel"
10. Verify offboarding CSV downloads with columns: employee, reason, status, last working day, tasks completed
11. Open each CSV in Excel → verify Arabic characters render correctly (UTF-8 BOM)
12. Verify audit log entries for each export

### Branch Manager scoping demo

**Login**: `manager@b-attend.app` / `demo1234` → redirects to `/dashboard`

1. Go to `/warnings` → see only New Cairo branch warnings
2. Go to `/training` → see only New Cairo branch training assignments
3. Go to `/assets` → see only New Cairo branch assets
4. Go to `/onboarding-checklists` → see only New Cairo branch onboarding
5. Go to `/offboarding` → see only New Cairo branch offboarding
6. Cannot access HR-4 pages for other branches

### Feature gate demo for HR-4

1. Login as `super@b-attend.app`.
2. Go to `/admin/tenants/[demo-tenant-id]` → Change plan → "Trial".
3. Logout, login as `owner@b-attend.app`.
4. Visit `/warnings` → upgrade prompt (HR-4 features require Growth plan or higher).
5. Visit `/training` → upgrade prompt.
6. Visit `/assets` → upgrade prompt.
7. Visit `/onboarding-checklists` → upgrade prompt.
8. Visit `/offboarding` → upgrade prompt.
9. (Switch the demo tenant back to Growth after testing.)

---

## 9. HR-5: Payroll demo

The HR-5 payroll module provides payroll profiles, payroll runs, payroll adjustments, and Excel export. Payroll calculations are derived from AttendanceDay data.

### Payroll Profiles demo flow

**Login**: `hr@b-attend.app` / `demo1234` → redirects to `/dashboard`

1. Go to `/hr/payroll-profiles`
2. See list of existing payroll profiles (if any) with employee name, salary type, base salary, payment method
3. Click "Create Profile" → fill in employee, salary type (FIXED/HOURLY/DAILY), base salary, payment method, allowances, deductions
4. Submit → profile created
5. View profile detail page showing all fields (employee, salary type, base salary, payment method, allowances, deductions, custom fields)
6. Edit profile → change base salary or payment method → save
7. Deactivate a profile → verify it shows as inactive
8. Verify only one active profile per employee is allowed (try creating a second active profile for the same employee → error)
9. Export profiles to Excel → verify CSV downloads with correct columns

### Payroll Run demo flow

**Login**: `hr@b-attend.app` / `demo1234` → redirects to `/dashboard`

1. Go to `/hr/payroll-runs`
2. See list of existing payroll runs (if any) with status badges
3. Click "Create Payroll Run" → select month and year
4. Submit → run created with status DRAFT
5. Lines are auto-generated from AttendanceDay data for all active employees with payroll profiles
6. View summary cards showing total base salary, total overtime, total deductions, net amount
7. View individual lines with employee name, base pay, overtime pay, late deduction, absent deduction, net amount
8. Move run through workflow:
   - DRAFT → click "Submit for Review" → status changes to REVIEW
   - REVIEW → click "Approve" → status changes to APPROVED
   - APPROVED → click "Lock" → status changes to LOCKED (read-only)
9. Verify locked run cannot be edited
10. Export payroll run to Excel → verify multi-sheet Excel downloads with:
    - Summary sheet (totals)
    - Lines sheet (per-employee breakdown)
    - Adjustments sheet (adjustments applied)
    - Missing Profiles sheet (employees without profiles)

### Payroll Adjustment demo flow

**Login**: `hr@b-attend.app` / `demo1234` → redirects to `/dashboard`

1. Go to `/hr/payroll-runs` → click into an existing run (or the one just created)
2. Click "Add Adjustment" → fill in employee, type (BONUS/DEDUCTION/ALLOWANCE/PENALTY), amount, reason
3. Submit → adjustment created with status PENDING
4. Click "Approve" on the adjustment → status changes to APPROVED → adjustment is reflected in payroll run totals
5. Add another adjustment → click "Reject" → status changes to REJECTED → adjustment is not reflected in totals
6. Add another adjustment → click "Cancel" → status is CANCELLED
7. Verify that approved adjustments appear in the payroll run summary and the adjustments Excel sheet
8. Verify audit log entries for each adjustment action (created, approved, rejected, cancelled)

### Access control demo

1. Login as `manager@b-attend.app` (Branch Manager) → try to access `/hr/payroll-profiles` → blocked (Branch Manager cannot access payroll)
2. Login as `employee@b-attend.app` (Employee) → try to access `/hr/payroll-profiles` → blocked (Employee cannot access payroll)
3. Login as `owner@b-attend.app` (Company Owner) → access `/hr/payroll-profiles` → allowed
4. Login as `hr@b-attend.app` (HR Admin) → access `/hr/payroll-runs` → allowed

### Feature gate demo

1. Login as `super@b-attend.app`.
2. Go to `/admin/tenants/[demo-tenant-id]` → Change plan → "Trial".
3. Logout, login as `owner@b-attend.app`.
4. Visit `/hr/payroll-profiles` → upgrade prompt (HR-5 features require Growth plan or higher).
5. Visit `/hr/payroll-runs` → upgrade prompt.
6. (Switch the demo tenant back to Growth after testing.)

---

## 10. HR-6: Reports demo

The HR-6 module provides a centralized HR Reports Hub and unified Excel export for all HR data.

### HR Reports Hub demo flow

1. Login as `owner@b-attend.app`.
2. Navigate to `/hr/reports`.
3. See 14 report cards grouped by category:
   - **People**: Employee Master, Headcount, Contracts Expiry
   - **Documents & Leave**: Documents Expiry, Missing Documents, Leave Balance, Leave Usage
   - **Compliance**: Warnings, Training, Assets
   - **Operations**: Onboarding, Offboarding
   - **Payroll**: Payroll Profiles, Payroll Run Summary (OWNER/HR_ADMIN only)
4. Each card shows a real DB record count.
5. Click any "Export Excel" button → downloads multi-sheet XLSX file.

### Branch Manager view

1. Login as `manager@b-attend.app`.
2. Navigate to `/hr/reports`.
3. See restricted view: no payroll reports, no offboarding reports.
4. Click "Export Excel" on Employee Master → only branch employees included.

### Unified Reports Excel Export

1. Login as `owner@b-attend.app`.
2. Visit `/api/tenant/hr/reports/excel?type=employee-master` → downloads employee master Excel.
3. Visit `/api/tenant/hr/reports/excel?type=all` → downloads all applicable reports as multi-sheet workbook.
4. Visit `/api/tenant/hr/reports/excel?type=payroll-runs` → downloads payroll run summary (OWNER/HR_ADMIN only).
5. Visit `/api/tenant/hr/reports/excel?type=invalid` → returns 400 error.

### Access control demo

1. Login as `employee@b-attend.app` → try to access `/hr/reports` → blocked (Employee cannot access HR Reports).
2. Login as `manager@b-attend.app` → access `/hr/reports` → allowed (branch-scoped view).
3. Login as `owner@b-attend.app` → access `/hr/reports` → full access including payroll reports.

### Feature gate demo

1. Login as `super@b-attend.app`.
2. Go to `/admin/tenants/[demo-tenant-id]` → Change plan → "Trial".
3. Logout, login as `owner@b-attend.app`.
4. Visit `/hr/reports` → upgrade prompt (HR features require Starter plan or higher).
5. (Switch the demo tenant back to Growth after testing.)
