/** /billing — customer-facing billing page */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubscriptionBadge, PlanBadge, InvoiceBadge } from "@/components/badges/StatusBadges";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { CreditCard, FileBarChart } from "lucide-react";

export const dynamic = "force-dynamic";

function money(amount: number, currency = "EGP") { return `${amount.toLocaleString()} ${currency}`; }

export default async function BillingPage() {
  const session = await getSession();
  if (!session?.tenantId) return null;
  const [tenant, subscription, invoices, planUsage] = await Promise.all([
    db.tenant.findUnique({ where: { id: session.tenantId } }),
    db.subscription.findUnique({ where: { tenantId: session.tenantId }, include: { plan: { include: { features: true } } } }),
    db.invoice.findMany({ where: { tenantId: session.tenantId }, include: { plan: true }, orderBy: { createdAt: "desc" } }),
    Promise.all([
      db.branch.count({ where: { companyId: session.tenantId, deletedAt: null } }),
      db.employee.count({ where: { companyId: session.tenantId, deletedAt: null } }),
      db.user.count({ where: { companyId: session.tenantId } }),
      db.kiosk === undefined ? Promise.resolve(0) : Promise.resolve(0),
    ]).then(([b, e, m, k]) => ({ branches: b, employees: e, managers: m, kiosks: k })),
  ]);

  const plan = subscription?.plan;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div><h1 className="text-lg font-bold text-foreground">Billing</h1><p className="text-sm text-muted-foreground">Your subscription, invoices, and plan usage.</p></div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Current subscription</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {subscription && plan ? (
            <>
              <div className="flex items-center gap-2">
                <PlanBadge name={plan.name} isTrial={plan.isTrial} isCustom={plan.isCustom} />
                <SubscriptionBadge status={subscription.status} />
                <Badge variant="outline" className="text-xs">{subscription.billingCycle}</Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {plan.isTrial ? "Free trial" : plan.isCustom ? "Custom" : money(subscription.billingCycle === "MONTHLY" ? subscription.monthlyAmount : subscription.annualAmount, subscription.currency)}
                <span className="text-sm font-normal text-muted-foreground"> /{subscription.billingCycle === "MONTHLY" ? "mo" : "yr"}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Period: {subscription.currentPeriodStart ? new Date(subscription.currentPeriodStart).toLocaleDateString() : "—"} → {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "—"}
              </div>
              {subscription.trialEndsAt && (
                <div className="rounded-md border border-amber-300 bg-amber-50/40 p-2 text-xs text-amber-800">
                  Trial ends on {new Date(subscription.trialEndsAt).toLocaleDateString()}
                </div>
              )}
            </>
          ) : <p className="text-sm text-muted-foreground">No active subscription.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Plan usage</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <Usage label="Branches" used={planUsage.branches} limit={plan?.maxBranches} />
            <Usage label="Employees" used={planUsage.employees} limit={plan?.maxEmployees} />
            <Usage label="Managers" used={planUsage.managers} limit={plan?.maxManagers} />
            <Usage label="Kiosks" used={0} limit={plan?.maxKiosks} />
          </div>
          {plan?.features && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Features</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {plan.features.filter((f) => f.enabled).map((f) => <Badge key={f.key} variant="outline" className="text-xs bg-brand-success/10 text-brand-success border-transparent">{f.label}</Badge>)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-foreground">Invoices</CardTitle>
            <Link href="/support" className="text-xs text-brand-accent hover:underline">Contact billing →</Link>
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? <EmptyState title="No invoices" icon={CreditCard} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Invoice #</th>
                    <th className="px-3 py-2 text-left font-medium">Total</th>
                    <th className="hidden px-3 py-2 text-left font-medium sm:table-cell">Due date</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2 font-medium text-foreground">{inv.number}</td>
                      <td className="px-3 py-2 text-muted-foreground">{money(inv.total, inv.currency)}</td>
                      <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</td>
                      <td className="px-3 py-2"><InvoiceBadge status={inv.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Need to upgrade?</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">If you&apos;re hitting plan limits or need advanced features, contact our billing team to upgrade.</p>
          <Link href="/support" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
            <FileBarChart className="h-3.5 w-3.5" /> Contact billing
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function Usage({ label, used, limit }: { label: string; used: number; limit?: number }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const danger = pct >= 90;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-semibold ${danger ? "text-destructive" : "text-foreground"}`}>{used}{limit ? ` / ${limit}` : ""}</p>
      </div>
      {limit && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={`h-full ${danger ? "bg-destructive" : "bg-brand-success"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
