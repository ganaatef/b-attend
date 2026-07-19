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
import { getTranslations, getLocale } from "next-intl/server";
import { getStatusLabel } from "@/lib/status-labels";

export const dynamic = "force-dynamic";

function money(amount: number, currency = "EGP") {
  return `${formatNumber(amount)} ${currency}`;
}

export default async function AdminDashboard() {
  const t = await getTranslations("admin");
  const locale = await getLocale();
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
    { label: t("totalCompanies"), value: totalTenants, icon: Building2, sub: `${activeTenants} ${t("active")} · ${trialTenants} ${t("trial")}` },
    { label: t("pendingActivation"), value: pendingTenants, icon: Hourglass, sub: t("awaitingReview"), highlight: pendingTenants > 0 },
    { label: t("suspended"), value: suspendedTenants, icon: AlertCircle, sub: t("actionRequired"), highlight: suspendedTenants > 0 },
    { label: t("mrr"), value: money(mrr), icon: TrendingUp, sub: `${t("arr")}: ${money(arr)}` },
    { label: t("pendingInvoices"), value: pendingInvoices, icon: CreditCard, sub: `${overdueInvoices} ${t("overdue")}`, highlight: overdueInvoices > 0 },
    { label: t("openTickets"), value: openTickets, icon: FileBarChart, sub: t("supportQueue") },
    { label: t("activeEmployees"), value: totalEmployees, icon: Users, sub: `${totalBranches} ${t("branchesCount")}` },
    { label: t("clockActionsToday"), value: punchesToday, icon: Activity, sub: t("acrossAllTenants") },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">{t("superAdminTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("superAdminSubtitle")}</p>
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
              <CardTitle className="text-sm font-semibold text-foreground">{t("recentTenants")}</CardTitle>
              <Link href="/admin/tenants" className="text-xs font-medium text-brand-accent hover:underline">{t("viewAll")}</Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentTenants.length === 0 ? (
              <EmptyState title={t("noTenants")} icon={Building2} />
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
              <CardTitle className="text-sm font-semibold text-foreground">{t("recentLeads", { count: newLeads })}</CardTitle>
              <Link href="/admin/leads" className="text-xs font-medium text-brand-accent hover:underline">{t("viewAll")}</Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <EmptyState title={t("noLeads")} icon={Users} />
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
              <CardTitle className="text-sm font-semibold text-foreground">{t("recentInvoices")}</CardTitle>
              <Link href="/admin/invoices" className="text-xs font-medium text-brand-accent hover:underline">{t("viewAll")}</Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <EmptyState title={t("noInvoices")} icon={CreditCard} />
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
              <CardTitle className="text-sm font-semibold text-foreground">{t("supportTickets")}</CardTitle>
              <Link href="/admin/support" className="text-xs font-medium text-brand-accent hover:underline">{t("viewAll")}</Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentTickets.length === 0 ? (
              <EmptyState title={t("noTickets")} icon={FileBarChart} />
            ) : (
              <div className="space-y-2">
                {recentTickets.map((t) => (
                  <Link key={t.id} href={`/admin/support/${t.id}`} className="block rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/40">
                    <div className="flex items-center justify-between">
                      <p className="truncate font-medium text-foreground">{t.subject}</p>
                       <Badge variant="outline" className="text-xs">{getStatusLabel(t.status, locale)}</Badge>
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
          <CardTitle className="text-sm font-semibold text-foreground">{t("quickActions")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/admin/tenants" className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40">
            <Building2 className="h-5 w-5 text-brand-accent" />
            <p className="mt-2 text-sm font-medium text-foreground">{t("manageTenants")}</p>
            <p className="text-xs text-muted-foreground">{t("manageTenantsDesc")}</p>
          </Link>
          <Link href="/admin/invoices" className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40">
            <CreditCard className="h-5 w-5 text-brand-accent" />
            <p className="mt-2 text-sm font-medium text-foreground">{t("billingInvoices")}</p>
            <p className="text-xs text-muted-foreground">{t("billingInvoicesDesc")}</p>
          </Link>
          <Link href="/admin/leads" className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40">
            <Users className="h-5 w-5 text-brand-accent" />
            <p className="mt-2 text-sm font-medium text-foreground">{t("leadsAction")}</p>
            <p className="text-xs text-muted-foreground">{t("leadsActionDesc")}</p>
          </Link>
          <Link href="/admin/plans" className="rounded-lg border border-border bg-card p-4 hover:bg-muted/40">
            <Layers className="h-5 w-5 text-brand-accent" />
            <p className="mt-2 text-sm font-medium text-foreground">{t("plansFeatures")}</p>
            <p className="text-xs text-muted-foreground">{t("plansFeaturesDesc", { count: plans.length })}</p>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
