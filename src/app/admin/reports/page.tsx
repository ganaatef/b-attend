/** /admin/reports — subscription usage report (Super Admin) */
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { TenantStatusBadge, PlanBadge } from "@/components/badges/StatusBadges";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { FileBarChart } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const t = await getTranslations("adminReports");
  const tenants = await db.tenant.findMany({
    include: { preferredPlan: true, subscription: { include: { plan: true } }, _count: { select: { employees: true, branches: true, punches: true } } },
    orderBy: { createdAt: "desc" },
  });

  const totalEmployees = tenants.reduce((s, t) => s + t._count.employees, 0);
  const totalBranches = tenants.reduce((s, t) => s + t._count.branches, 0);
  const totalPunches = tenants.reduce((s, t) => s + t._count.punches, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("summary", { tenants: tenants.length, employees: totalEmployees, branches: totalBranches, punches: totalPunches })}</p>
      </div>
      <Card className="border-border">
        {tenants.length === 0 ? <EmptyState title={t("noData")} icon={FileBarChart} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t("tenant")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("plan")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("status")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("employees")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("branches")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("punches")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("mrr")}</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => {
                  const plan = t.subscription?.plan ?? t.preferredPlan;
                  const mrr = t.subscription ? (t.subscription.billingCycle === "MONTHLY" ? t.subscription.monthlyAmount : Math.floor(t.subscription.annualAmount / 12)) : 0;
                  return (
                    <tr key={t.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                      <td className="px-4 py-3">{plan ? <PlanBadge name={plan.name} isTrial={plan.isTrial} isCustom={plan.isCustom} /> : "—"}</td>
                      <td className="px-4 py-3"><TenantStatusBadge status={t.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{t._count.employees} / {plan?.maxEmployees ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t._count.branches} / {plan?.maxBranches ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t._count.punches}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatNumber(mrr)} EGP</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                  <td className="px-4 py-3 text-foreground" colSpan={3}>{t("total")}</td>
                  <td className="px-4 py-3 text-foreground">{totalEmployees}</td>
                  <td className="px-4 py-3 text-foreground">{totalBranches}</td>
                  <td className="px-4 py-3 text-foreground">{totalPunches}</td>
                  <td className="px-4 py-3 text-foreground">{formatNumber(tenants.reduce((s, t) => s + (t.subscription ? (t.subscription.billingCycle === "MONTHLY" ? t.subscription.monthlyAmount : Math.floor(t.subscription.annualAmount / 12)) : 0), 0))} EGP</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
