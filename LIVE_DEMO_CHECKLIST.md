# B-Attend — Live Demo Checklist

Use this checklist after deploying to Vercel (see `DEPLOYMENT.md`). All demo accounts use
password **`demo1234`**.

> Demo credentials are for the **client demo only** and must be changed before any real
> production launch.

---

## Public (no login)

- [ ] Landing page `/` opens (shows plan cards from DB)
- [ ] Login page `/login` opens
- [ ] Pricing page `/pricing` opens (if enabled)
- [ ] Request-demo `/request-demo` opens (if enabled)

---

## Super Admin — `super@b-attend.app`

- [ ] Login redirects to `/admin`
- [ ] `/admin` dashboard loads (metrics: tenants, plans, users)
- [ ] Tenants list opens (`/admin/tenants`)
- [ ] Plans list opens (`/admin/plans`)
- [ ] Subscriptions / billing opens (`/admin/subscriptions` or invoices)
- [ ] Can create/activate a tenant (manual activation mode)

---

## Owner — `owner@b-attend.app`

- [ ] Login redirects to tenant dashboard
- [ ] `/hr` opens (HR hub)
- [ ] `/hr/reports` opens (14 report cards with real counts)
- [ ] Export an HR Excel report (downloads `.xlsx`)
- [ ] Payroll runs `/hr/payroll-runs` opens
- [ ] Export a payroll Excel (downloads `.xlsx`)
- [ ] Sees only own tenant's data (no cross-tenant leakage)

---

## HR Admin — `hr@b-attend.app`

- [ ] Login opens HR area
- [ ] Leave management `/hr/leaves` opens
- [ ] Can **approve** a pending leave request
- [ ] Can **reject** a pending leave request
- [ ] Documents `/hr/documents` and Contracts `/hr/contracts` open
- [ ] Employee records open

---

## Branch Manager — `manager@b-attend.app`

- [ ] Login opens manager view
- [ ] Data is **scoped to New Cairo branch** only
- [ ] Visiting payroll (`/hr/payroll-runs`, `/hr/payroll-profiles`) is **blocked**
- [ ] Sensitive documents / other branches are **blocked**

---

## Employee — `employee@b-attend.app`

- [ ] Login opens employee view
- [ ] `/today` opens
- [ ] `/clock` opens (clock-in/out UI)
- [ ] `/my-leave` (self-service leave) opens
- [ ] Can **submit** a pending leave request
- [ ] Can **cancel** a pending leave request
- [ ] Visiting `/hr` (admin) is **blocked**
- [ ] Visiting `/admin` (super) is **blocked**

---

## Excel exports

- [ ] Download at least one HR report from `/hr/reports` → file opens in Excel
- [ ] Download a payroll Excel from `/hr/payroll-runs` → file opens in Excel
- [ ] Exported file shows the correct tenant name (not hardcoded)
- [ ] All numbers render with Western (Latin) digits regardless of browser locale

---

## Security / access control

- [ ] Visiting a protected route while **logged out** → redirected to `/login`
- [ ] Employee visits `/hr` → blocked (access denied / redirect)
- [ ] Manager visits payroll → blocked
- [ ] Non-authenticated Excel export URL → rejected (401/redirect)

---

## Post-demo

- [ ] Note any failed checks above with screenshots
- [ ] If demo succeeded: plan password rotation + real env values before production
- [ ] Keep `DEMO_SEED_CONFIRM=false` in production env
