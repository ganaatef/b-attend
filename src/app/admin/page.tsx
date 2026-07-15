/**
 * /admin — Real Super Admin dashboard with DB-backed metrics.
 */
import { formatNumber } from "@/lib/utils";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Layers, FileBarChart, Hourglass, CreditCard, AlertCircle, CheckCircle2, TrendingUp, Activity } from "lucide-react";
import { TenantStatusBadge, LeadBadge, InvoiceBadge } from "@/components/badges/StatusBadges";
import { EmptyState } from "@/components/ui-empty/EmptyState";

export const dynamic = "force-dynamic";

function money(amount: number, currency = "EGP") {
  return `${formatNumber(amount)} ${currency}`;
}

export default async function AdminDashboard() {
  const [
    totalTenants, activeTenants, trialTenants, pendingTenants, suspendedTenants,
    totalEmployees, totalBranches, pendingInvoices, overdueInvoices, openTickets,
    totalLeads, newLeads, plans, recentLeads, recentTenants, recentInvoices, recentTickets, punchesToday,
  ] = await Promise.all([
    db.tenant.count(),
    db.tenant.count({ where: { status: "ACTIVE" } }),
    db.tenant.count({ where: { status: "TRIAL_ACTIVE" } }),
    db.tenant.count({ where: { status: "PENDING_ACTIVATION" } }),
    db.tenant.count({ where: { status: "SUSPENDED" } }),
    db.employee.count({ where: { status: "ACTIVE" } }),
    db.branch.count({ where: { status: "ACTIVE" } }),
    db.invoice.count({ where: { status: "PENDING_PAYMENT" } }),
    db.invoice.count({ where: { status: "OVERDUE" } }),
    db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] } } }),
    db.lead.count(),
    db.lead.count({ where: { status: "NEW" } }),
    db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.lead.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { assignedTo: true } }),
    db.tenant.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
    db.invoice.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { tenant: true } }),
    db.supportTicket.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { tenant: true } }),
    db.punch.count({ where: { timestamp: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
  ]);

  // MRR / ARR
  const activeSubs = await db.subscription.findMany({ where: { status: "ACTIVE" }, include: { plan: true } });
  const mrr = activeSubs.reduce((sum, s) => sum + (s.billingCycle === "MONTHLY" ? s.monthlyAmount : Math.floor(s.annualAmount / 12)), 0);
  const arr = mrr * 12;

  const stats = [
    { label: "Total companies", value: totalTenants, icon: Building2, sub: `${activeTenants} active · ${trialTenants} trial` },
    { label: "Pending activation", value: pendingTenants, icon: Hourglass, sub: "Awaiting review", highlight: pendingTenants > 0 },
    { label: "Suspended", value: suspendedTenants, icon: AlertCircle, sub: "Action required", highlight: suspendedTenants > 0 },
    { label: "MRR", value: money(mrr), icon: TrendingUp, sub: `ARR: ${money(arr)}` },
    { label: "Pending invoices", value: pendingInvoices, icon: CreditCard, sub: `${overdueInvoices} overdue`, highlight: overdueInvoices > 0 },
    { label: "Open tickets", value: openTickets, icon: FileBarChart, sub: "Support queue" },
    { label: "Active employees", value: totalEmployees, icon: Users, sub: `${totalBranches} branches` },
    { label: "Clock actions today", value: punchesToday, icon: Activity, sub: "Across all tenants" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Super Admin Control Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">Platform-wide metrics, tenant management, and billing operations.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className={s.highlight ? "border-amber-300 bg-amber-50/40" : "border-border"}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{s.label}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground">Recent tenants</CardTitle>
              <Link href="/admin/tenants" className="text-xs font-medium text-brand-accent hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentTenants.length === 0 ? (
              <EmptyState title="No tenants yet" icon={Building2} />
            ) : (
              <div className="space-y-2">
                {recentTenants.map((t) => (
                  <Link key={t.id} href={`/admin/tenants/${t.id}`} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/40">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.ownerEmail}</p>
                    </div>
                    <TenantStatusBadge status={t.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground">Recent leads ({newLeads} new)</CardTitle>
              <Link href="/admin/leads" className="text-xs font-medium text-brand-accent hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <EmptyState title="No leads yet" icon={Users} />
            ) : (
              <div className="space-y-2">
                {recentLeads.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{l.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{l.company ?? l.email}</p>
                    </div>
                    <LeadBadge status={l.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground">Recent invoices</CardTitle>
              <Link href="/admin/invoices" className="text-xs font-medium text-brand-accent hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <EmptyState title="No invoices yet" icon={CreditCard} />
            ) : (
              <div className="space-y-2">
                {recentInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{inv.number}</p>
                      <p className="truncate text-xs text-muted-foreground">{inv.tenant?.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{money(inv.total, inv.currency)}</span>
                      <InvoiceBadge status={inv.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground">Support tickets</CardTitle>
              <Link href="/admin/support" className="text-xs font-medium text-brand-accent hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentTickets.length === 0 ? (
              <EmptyState title="No tickets yet" icon={FileBarChart} />
            ) : (
              <div className="space-y-2">
                {recentTickets.map((t) => (
                  <Link key={t.id} href={`/admin/support/${t.id}`} className="block rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/40">
                    <div className="flex items-center justify-between">
                      <p className="truncate font-medium text-foreground">{t.subject}</p>
                      <Badge variant="outline" className="text-xs">{t.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{t.tenant?.name ?? t.createdByEmail}</p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/tenants" className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40">
            <Building2 className="h-5 w-5 text-brand-accent" />
            <p className="mt-2 text-sm font-medium text-foreground">Manage tenants</p>
            <p className="text-xs text-muted-foreground">Activate, suspend, cancel</p>
          </Link>
          <Link href="/admin/invoices" className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40">
            <CreditCard className="h-5 w-5 text-brand-accent" />
            <p className="mt-2 text-sm font-medium text-foreground">Billing & invoices</p>
            <p className="text-xs text-muted-foreground">Create invoices, mark paid</p>
          </Link>
          <Link href="/admin/leads" className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40">
            <Users className="h-5 w-5 text-brand-accent" />
            <p className="mt-2 text-sm font-medium text-foreground">Leads</p>
            <p className="text-xs text-muted-foreground">Demo requests & contacts</p>
          </Link>
          <Link href="/admin/plans" className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40">
            <Layers className="h-5 w-5 text-brand-accent" />
            <p className="mt-2 text-sm font-medium text-foreground">Plans & features</p>
            <p className="text-xs text-muted-foreground">{plans.length} plans active</p>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
