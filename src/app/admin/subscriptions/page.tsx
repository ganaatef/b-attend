/** /admin/subscriptions */
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { SubscriptionBadge, PlanBadge, TenantStatusBadge } from "@/components/badges/StatusBadges";
import Link from "next/link";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { CreditCard } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const t = await getTranslations("adminSubscriptions");
  const subs = await db.subscription.findMany({
    include: { tenant: true, plan: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("total", { count: subs.length })}</p>
      </div>
      <Card className="border-border">
        {subs.length === 0 ? <EmptyState title={t("noSubscriptions")} icon={CreditCard} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t("tenant")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("plan")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("billingCycle")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("amount")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("period")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/admin/tenants/${s.tenantId}`} className="font-medium text-foreground hover:text-brand-accent">{s.tenant.name}</Link>
                      <p className="text-xs text-muted-foreground"><TenantStatusBadge status={s.tenant.status} /></p>
                    </td>
                    <td className="px-4 py-3"><PlanBadge name={s.plan.name} isTrial={s.plan.isTrial} isCustom={s.plan.isCustom} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{s.billingCycle.toLowerCase()}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.billingCycle === "MONTHLY" ? s.monthlyAmount : s.annualAmount} {s.currency}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {s.currentPeriodStart ? new Date(s.currentPeriodStart).toLocaleDateString() : "—"} → {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3"><SubscriptionBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
