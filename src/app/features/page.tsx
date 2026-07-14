/**
 * /features — feature overview with detailed cards grouped by category.
 */
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import {
  Clock, MapPin, Building2, CalendarClock, CheckSquare,
  FileBarChart, Download, ShieldCheck, Users, Bell, Lock,
  ArrowRight, TabletSmartphone, ScrollText, Settings, CreditCard,
} from "lucide-react";

const groups = [
  {
    title: "Attendance & Clock",
    items: [
      { icon: Clock, title: "Mobile clock in/out", body: "Employees clock via mobile-friendly web page. Browser geolocation captures lat/long on every punch." },
      { icon: MapPin, title: "GPS geofence validation", body: "Each branch has a configurable radius. Distance is calculated via Haversine and saved in meters." },
      { icon: TabletSmartphone, title: "Branch kiosk mode", body: "Tablet at the entrance. Employees enter PIN, see their shift, and clock in seconds." },
      { icon: ShieldCheck, title: "Anti-fake location (roadmap)", body: "Placeholders for mock-location detection, device fingerprinting, and impossible-travel detection." },
    ],
  },
  {
    title: "Scheduling & Shifts",
    items: [
      { icon: CalendarClock, title: "Shift policies", body: "Define start/end, break, late grace, early-leave grace, overtime threshold, weekend days." },
      { icon: CalendarClock, title: "Overnight shift support", body: "Shifts crossing midnight (e.g. 17:00 → 01:00) calculate worked minutes correctly." },
      { icon: Building2, title: "Bulk schedule generation", body: "Select branch, employees, date range, shift policy, weekend/off days. Skips duplicates." },
      { icon: CheckSquare, title: "Approval workflow", body: "Manual clock-in/out, missing clock-out, outside geofence, overtime, leave, permission requests." },
    ],
  },
  {
    title: "Reports & Exports",
    items: [
      { icon: FileBarChart, title: "Daily attendance", body: "Real rows from AttendanceDay with status, late/early-leave minutes, overtime, exception flags." },
      { icon: FileBarChart, title: "Monthly summary", body: "Per-employee totals: present/absent/leave/off days, late minutes, worked hours, overtime." },
      { icon: FileBarChart, title: "Exceptions & overtime", body: "Filter rows that require approval, or where overtimeMinutes > 0 (even after approval)." },
      { icon: Download, title: "CSV export with BOM", body: "UTF-8 BOM for Arabic. Proper escaping of quotes, commas, newlines. Respects filters." },
    ],
  },
  {
    title: "Multi-tenant SaaS",
    items: [
      { icon: Users, title: "Roles & permissions", body: "Company Owner, HR Admin, Branch Manager, Employee. Capability-based, enforced server-side." },
      { icon: Lock, title: "Tenant isolation", body: "Strict companyId scoping on every query. Branch managers see only their assigned branch." },
      { icon: ScrollText, title: "Audit log", body: "Tenant-scoped audit for operational actions. Platform-scoped audit for super admin actions." },
      { icon: CreditCard, title: "Subscription & billing", body: "Trial, Starter, Growth, Pro, Enterprise. Manual activation, invoices, payments, grace periods." },
    ],
  },
  {
    title: "Admin & Operations",
    items: [
      { icon: ShieldCheck, title: "Super Admin control center", body: "Internal team manages tenants, plans, subscriptions, invoices, leads, support, audit." },
      { icon: Bell, title: "Notifications (in-app)", body: "Alerts for approvals, exceptions, trial ending. Email & WhatsApp placeholders for later phases." },
      { icon: Settings, title: "Customer settings", body: "Geofence radius, grace minutes, overtime threshold, mobile/kiosk toggles, approval rules." },
      { icon: ScrollText, title: "Compliance-ready", body: "Consent placeholders for location tracking. Data retention settings. No biometric storage in MVP." },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <PublicLayout>
      <section className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Every feature operational teams need
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            From mobile clock-in to payroll export — all in one platform, no add-ons.
          </p>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {groups.map((g) => (
              <div key={g.title}>
                <h2 className="text-lg font-bold text-foreground sm:text-xl">{g.title}</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    return (
                      <div key={it.title} className="rounded-lg border border-border bg-card p-5">
                        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-brand-accent/10 text-brand-accent">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">{it.title}</h3>
                        <p className="mt-1.5 text-xs text-muted-foreground">{it.body}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 rounded-xl border border-border bg-card p-8 text-center">
            <h2 className="text-xl font-bold text-foreground">Ready to get started?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Start your 14-day trial or talk to our sales team.
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
              >
                Start Trial <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/request-demo"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted sm:w-auto"
              >
                Book a Demo
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
