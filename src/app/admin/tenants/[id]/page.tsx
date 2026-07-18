/**
 * /admin/tenants/[id] — tenant detail with usage, subscription, invoices, audit, actions.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TenantStatusBadge, SubscriptionBadge, PlanBadge, InvoiceBadge } from "@/components/badges/StatusBadges";
import { TenantActions } from "../TenantActions";
import { ChangePlanForm } from "./ChangePlanForm";
import { CreateInvoiceForm } from "./CreateInvoiceForm";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Building2, Users, Clock, FileBarChart, ScrollText } from "lucide-react";
import { formatNumber, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function money(amount: number, currency = "EGP") { return `${formatNumber(amount)} ${currency}`; }

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tn = await getTranslations("adminTenants");
  const ts = await getTranslations("adminSubscriptions");
  const ti = await getTranslations("adminInvoices");
  const ta = await getTranslations("adminAudit");

  const tenant = await db.tenant.findUnique({
    where: { id },
    include: {
      preferredPlan: true,
      subscription: { include: { plan: { include: { features: true } } } },
      _count: { select: { employees: true, branches: true, users: true, schedules: true, punches: true, invoices: true } },
    },
  });
  if (!tenant) notFound();

  const [invoices, auditLogs, branches, employees] = await Promise.all([
    db.invoice.findMany({ where: { tenantId: id }, include: { plan: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.auditLog.findMany({ where: { companyId: id }, orderBy: { createdAt: "desc" }, take: 15 }),
    db.branch.findMany({ where: { companyId: id, deletedAt: null }, include: { _count: { select: { employees: true } } } }),
    db.employee.findMany({ where: { companyId: id, deletedAt: null }, include: { branch: true, department: true }, take: 10, orderBy: { createdAt: "desc" } }),
  ]);

  const plan = tenant.subscription?.plan;
  const usage = [
    { label: tn("branches"), used: branches.length, limit: plan?.maxBranches ?? 0 },
    { label: tn("employees"), used: tenant._count.employees, limit: plan?.maxEmployees ?? 0 },
    { label: tn("users"), used: tenant._count.users, limit: plan?.maxManagers ?? 0 },
    { label: tn("schedules"), used: tenant._count.schedules, limit: 0 },
    { label: tn("punches"), used: tenant._count.punches, limit: 0 },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/admin/tenants" className="hover:text-foreground">{tn("tenantsLink")}</Link>
          </div>
          <h1 className="mt-1 text-lg font-bold text-foreground">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">{tenant.ownerName} · {tenant.ownerEmail} · {tenant.ownerPhone}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TenantStatusBadge status={tenant.status} />
            {plan && <PlanBadge name={plan.name} isTrial={plan.isTrial} isCustom={plan.isCustom} />}
            {tenant.subscription && <SubscriptionBadge status={tenant.subscription.status} />}
          </div>
        </div>
        <TenantActions tenantId={tenant.id} status={tenant.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{tn("businessType")}</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm font-medium text-foreground">{tenant.businessType.replace(/_/g, " ")}</p>
            <p className="text-xs text-muted-foreground">{tenant.city ?? tn("noCitySet")}</p>
            <p className="mt-2 text-xs text-muted-foreground">{tn("declaredAtSignup", { employees: tenant.employeesCount, branches: tenant.branchesCount })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{ts("title")}</CardTitle></CardHeader>
          <CardContent>
            {tenant.subscription ? (
              <>
                <p className="text-sm font-medium text-foreground">{plan?.name} · {tenant.subscription.billingCycle.toLowerCase()}</p>
                <p className="text-xs text-muted-foreground">
                  {tenant.subscription.currentPeriodStart ? new Date(tenant.subscription.currentPeriodStart).toLocaleDateString() : "—"} → {tenant.subscription.currentPeriodEnd ? new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString() : "—"}
                </p>
                {tenant.subscription.trialEndsAt && (
                  <p className="mt-1 text-xs text-amber-700">{tn("trialEndsLabel")} {new Date(tenant.subscription.trialEndsAt).toLocaleDateString()}</p>
                )}
              </>
            ) : <p className="text-sm text-muted-foreground">{tn("noSubscription")}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{tn("planLimits")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {usage.map((u) => (
                <div key={u.label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{u.label}</span>
                  <span className="font-medium text-foreground">{u.used}{u.limit > 0 ? ` / ${u.limit}` : ""}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">{tn("branchesCountTitle", { count: branches.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            {branches.length === 0 ? <EmptyState title={tn("noBranches")} icon={Building2} /> : (
              <div className="space-y-2">
                {branches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.address ?? b.city ?? "—"}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{b._count.employees} {tn("empAbbrev")}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">{tn("recentEmployeesTitle", { count: tenant._count.employees })}</CardTitle>
          </CardHeader>
          <CardContent>
            {employees.length === 0 ? <EmptyState title={tn("noEmployees")} icon={Users} /> : (
              <div className="space-y-2">
                {employees.map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{e.fullName}</p>
                      <p className="text-xs text-muted-foreground">{e.employeeCode} · {e.branch?.name ?? "—"}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{e.department?.name ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">{ti("countTitle", { count: tenant._count.invoices })}</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? <EmptyState title={ti("noInvoices")} icon={FileBarChart} /> : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{inv.number}</p>
                      <p className="text-xs text-muted-foreground">{ti("due")}: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</p>
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
            <CardTitle className="text-sm font-semibold text-foreground">{tn("changePlanBillingCycle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {tenant.subscription ? <ChangePlanForm tenantId={tenant.id} currentPlanId={tenant.subscription.planId} currentCycle={tenant.subscription.billingCycle} /> : <p className="text-sm text-muted-foreground">{tn("noSubscriptionToModify")}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">{tn("createManualInvoice")}</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateInvoiceForm tenantId={tenant.id} defaultPlanId={plan?.id} defaultCurrency={tenant.subscription?.currency ?? "EGP"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">{ta("countTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? <EmptyState title={ta("noAudit")} icon={ScrollText} /> : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto battend-scroll">
              {auditLogs.map((l) => (
                <div key={l.id} className="flex items-start gap-3 rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                  <Clock className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{l.action.replace(/_/g, " ")}</p>
                    <p className="text-muted-foreground">{l.actorEmail} · {l.entityType ?? "—"}</p>
                    {l.reason && <p className="text-muted-foreground">{ta("reason")}: {l.reason}</p>}
                  </div>
                  <span className="text-muted-foreground">{formatDateTime(l.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
