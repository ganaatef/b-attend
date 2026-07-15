/** /admin/plans */
import Link from "next/link";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PlanBadge } from "@/components/badges/StatusBadges";
import { Check, X } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const plans = await db.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { features: true, _count: { select: { subscriptions: true } } },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">Plans</h1>
        <p className="text-sm text-muted-foreground">{plans.length} plans. Click a plan to edit limits and feature flags.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        {plans.map((p) => (
          <Card key={p.id} className="border-border p-4">
            <div className="flex items-center justify-between">
              <PlanBadge name={p.name} isTrial={p.isTrial} isCustom={p.isCustom} />
              <span className="text-xs text-muted-foreground">{p._count.subscriptions} subs</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {p.isTrial ? "Free" : p.isCustom ? "Custom" : `${formatNumber(p.priceMonthly)} EGP/mo`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
            <div className="mt-3 space-y-0.5 text-xs text-muted-foreground">
              <p>{p.maxBranches} branches · {p.maxEmployees} employees</p>
              <p>{p.reportsLevel.toLowerCase()} reports · {p.auditRetentionDays}d audit</p>
              <p>{p.supportLevel.toLowerCase().replace(/_/g, " ")} support</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {p.features.filter((f) => f.enabled).slice(0, 5).map((f) => (
                <span key={f.key} className="rounded bg-brand-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-accent">{f.key}</span>
              ))}
              {p.features.filter((f) => f.enabled).length > 5 && <span className="text-[10px] text-muted-foreground">+{p.features.filter((f) => f.enabled).length - 5} more</span>}
            </div>
            <Link href={`/admin/plans/${p.id}`} className="mt-3 block rounded-md bg-primary px-3 py-1.5 text-center text-xs font-semibold text-primary-foreground hover:bg-primary/90">Edit plan</Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
