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
