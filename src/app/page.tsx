/**
 * B-Attend landing page — /
 * Sections: Hero, Problem, Solution, Features, How it works, Use cases,
 * Pricing preview (DB-backed), Testimonials placeholder, FAQ, CTA.
 */
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Logo } from "@/components/layout/Logo";
import { db } from "@/lib/db";
import {
  MapPin,
  Clock,
  ShieldCheck,
  CalendarClock,
  CheckSquare,
  FileBarChart,
  Download,
  Building2,
  Bell,
  Users,
  Lock,
  ArrowRight,
  Check,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getActivePlans() {
  return db.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { features: true },
  });
}

export default async function HomePage() {
  const plans = await getActivePlans();
  const previewPlans = plans.filter((p) => !p.isCustom).slice(0, 4);

  return (
    <PublicLayout>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-card to-background">
        <div className="absolute inset-0 -z-10 opacity-50">
          <div className="absolute -top-32 right-0 h-72 w-72 rounded-full bg-brand-accent/20 blur-3xl" />
          <div className="absolute -bottom-32 left-0 h-72 w-72 rounded-full bg-brand-navy/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-success" />
              Built for operational teams everywhere
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              B-Attend
            </h1>
            <p className="mt-3 text-lg font-medium text-brand-accent sm:text-xl">
              Attendance and shift control for operational teams
            </p>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Track attendance, verify location, manage shifts, approve exceptions, and export
              payroll-ready reports — all from one clean dashboard built for restaurants, cafes,
              retail, gyms, clinics, warehouses, and security teams.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
              >
                Start 14-day Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/request-demo"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted sm:w-auto"
              >
                Book a Demo
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              No credit card required · Manual activation available · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              The cost of uncontrolled attendance
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Operational teams lose hours every week chasing paper timesheets, buddy-punching,
              missing clock-outs, and payroll reconciliation errors. Spreadsheets don&apos;t scale
              across branches. Generic HR tools miss the floor reality.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {[
              {
                title: "Buddy punching & fake locations",
                body: "Employees clock in for each other or from outside the branch without anyone noticing until payroll.",
              },
              {
                title: "Missing clock-outs & exceptions",
                body: "Manual reconciliation across paper sheets and chat messages eats hours every payroll cycle.",
              },
              {
                title: "No visibility across branches",
                body: "Owners cannot tell who showed up on time at each branch until the end of the month.",
              },
            ].map((p) => (
              <div key={p.title} className="rounded-lg border border-border bg-card p-5">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-brand-danger/10 text-brand-danger">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{p.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                One dashboard for attendance, shifts, and approvals
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                B-Attend brings your branches, employees, schedules, and approvals into a single
                source of truth. Owners see real-time attendance, managers handle exceptions in
                seconds, and employees get a clean self-service clock page on their phone.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "GPS-verified clock in/out with branch geofence",
                  "Shift policies with overnight support and overtime rules",
                  "Bulk schedule generation by branch and date range",
                  "Approval workflow for missing punches and leave requests",
                  "Payroll-ready CSV exports with UTF-8 BOM for Arabic compatibility",
                  "Audit log of every important action",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-success" />
                    <span className="text-foreground/90">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Logo className="h-6 w-6" />
                <span className="text-sm font-semibold text-foreground">Live attendance preview</span>
              </div>
              <div className="space-y-2.5">
                {[
                  { name: "Ahmed M.", branch: "New Cairo", status: "On time", color: "bg-brand-success" },
                  { name: "Sara A.", branch: "Nasr City", status: "Late 7m", color: "bg-brand-warning" },
                  { name: "Khaled I.", branch: "Maadi", status: "Outside geofence", color: "bg-brand-danger" },
                  { name: "Mona S.", branch: "New Cairo", status: "On time", color: "bg-brand-success" },
                ].map((r) => (
                  <div
                    key={r.name}
                    className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${r.color}`} />
                      <span className="font-medium text-foreground">{r.name}</span>
                      <span className="text-muted-foreground">· {r.branch}</span>
                    </div>
                    <span className="text-muted-foreground">{r.status}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground">
                Illustrative preview. Real data appears once your branches and employees are set up.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Everything operational teams need
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              From mobile clock-in to payroll export — no add-ons, no fragmented tools.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Clock, title: "Mobile clock in/out", body: "Web clock with GPS capture, no app install required." },
              { icon: MapPin, title: "GPS geofence validation", body: "Branch radius enforced on every punch with distance saved." },
              { icon: Building2, title: "Branch kiosk mode", body: "Fast PIN lookup for shared tablets at the branch entrance." },
              { icon: CalendarClock, title: "Shift scheduling", body: "Per-employee schedules with overnight shift support." },
              { icon: CheckSquare, title: "Approval workflow", body: "Missing punches, leave, and overtime — all auditable." },
              { icon: FileBarChart, title: "Payroll-ready reports", body: "Daily, monthly, exceptions, overtime, branch, payroll." },
              { icon: Download, title: "CSV export", body: "UTF-8 BOM for Arabic characters, escaped for Excel." },
              { icon: ShieldCheck, title: "Audit log", body: "Every important action tracked, tenant & platform scoped." },
              { icon: Users, title: "Multi-branch management", body: "Roles for owners, HR, branch managers, employees." },
              { icon: Lock, title: "Role-based access", body: "Capability-based permissions enforced server-side." },
              { icon: Bell, title: "Notifications", body: "In-app alerts for approvals, exceptions, and trial ending." },
              { icon: ShieldCheck, title: "Subscription plans", body: "Trial, Starter, Growth, Pro, Enterprise — manual activation." },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-lg border border-border bg-card p-5">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-brand-accent/10 text-brand-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              How it works
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              From signup to first payroll export in less than a day.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-4">
            {[
              { step: "01", title: "Sign up", body: "Submit your company details and preferred plan. Manual activation available." },
              { step: "02", title: "Onboard", body: "Create branches, departments, shift policies, and employees in a guided wizard." },
              { step: "03", title: "Schedule & clock", body: "Generate bulk schedules. Employees clock in via mobile or kiosk." },
              { step: "04", title: "Approve & export", body: "Review exceptions, approve requests, and export payroll-ready CSV." },
            ].map((s) => (
              <div key={s.step} className="rounded-lg border border-border bg-background p-5">
                <span className="text-xs font-semibold text-brand-accent">{s.step}</span>
                <h3 className="mt-1 text-sm font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Built for operational teams
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              One platform, many shift-driven industries.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Restaurants & Cloud Kitchens",
              "Cafes & Juice Bars",
              "Retail Chains",
              "Gyms & Fitness",
              "Clinics & Pharmacies",
              "Warehouses",
              "Security Companies",
              "Cleaning Companies",
            ].map((u) => (
              <div key={u} className="rounded-lg border border-border bg-card px-4 py-4 text-sm font-medium text-foreground">
                {u}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING PREVIEW (DB-backed) */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Plans that scale with you
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Prices in EGP. Annual billing saves two months. Manual activation available for B2B.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {previewPlans.map((p) => (
              <div key={p.id} className="flex flex-col rounded-lg border border-border bg-background p-5">
                <h3 className="text-sm font-semibold text-foreground">{p.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{p.description}</p>
                <div className="mt-3">
                  {p.isTrial ? (
                    <p className="text-2xl font-bold text-foreground">Free</p>
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {formatNumber(p.priceMonthly)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">EGP/mo</span>
                    </p>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Up to {p.maxEmployees} employees · {p.maxBranches} {p.maxBranches === 1 ? "branch" : "branches"}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-accent hover:underline"
            >
              Compare all plans <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS PLACEHOLDER */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Customer testimonials will be added as B-Attend goes live with paying customers.
              No fabricated logos or quotes.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Frequently asked questions
          </h2>
          <div className="mt-8 space-y-4">
            {[
              { q: "Is there a free trial?", a: "Yes — 14 days, one branch, up to 10 employees. No credit card required." },
              { q: "Do you support manual activation?", a: "Yes. Manual activation is the default for B2B. A Super Admin reviews each signup and activates the subscription." },
              { q: "Does the clock work without installing an app?", a: "Yes. Employees clock in via a mobile-friendly web page using browser geolocation. Kiosk mode is also available for shared tablets." },
              { q: "Can I export payroll data in Arabic?", a: "CSV exports use UTF-8 with BOM so Arabic characters render correctly in Excel." },
              { q: "What happens if my subscription is suspended?", a: "Owners can still access billing and support. Operational pages and clock-in are blocked until payment is resolved." },
            ].map((f) => (
              <div key={f.q} className="rounded-lg border border-border bg-background p-5">
                <h3 className="text-sm font-semibold text-foreground">{f.q}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-primary-foreground sm:text-3xl">
            Be present. Be verified.
          </h2>
          <p className="mt-3 text-sm text-primary-foreground/80 sm:text-base">
            Start tracking attendance the right way today. No credit card required.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary-foreground px-5 py-3 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary-foreground/90 sm:w-auto"
            >
              Start 14-day Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-primary-foreground/40 px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10 sm:w-auto"
            >
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
