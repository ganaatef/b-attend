/**
 * /admin/tenants — list all tenants with filters.
 */
import Link from "next/link";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { TenantStatusBadge, PlanBadge } from "@/components/badges/StatusBadges";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Building2 } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { getStatusLabel } from "@/lib/status-labels";

export const dynamic = "force-dynamic";

export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const t = await getTranslations("adminTenants");
  const locale = await getLocale();
  const params = await searchParams;
  const where: any = {};
  if (params.status) where.status = params.status;
  if (params.q) {
    where.OR = [
      { name: { contains: params.q } },
      { ownerEmail: { contains: params.q } },
      { slug: { contains: params.q } },
    ];
  }
  const tenants = await db.tenant.findMany({
    where,
    include: { preferredPlan: true, subscription: { include: { plan: true } }, _count: { select: { employees: true, branches: true, users: true } } },
    orderBy: { createdAt: "desc" },
  });

  const statusFilters = ["ALL", "PENDING_ACTIVATION", "TRIAL_ACTIVE", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED", "REJECTED"];

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("companyCount", { count: tenants.length })}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {statusFilters.map((s) => {
          const active = (params.status ?? "ALL") === s || (s === "ALL" && !params.status);
          return (
            <Link
              key={s}
              href={s === "ALL" ? "/admin/tenants" : `/admin/tenants?status=${s}`}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${active ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"}`}
            >
              {s === "ALL" ? t("all") : getStatusLabel(s, locale)}
            </Link>
          );
        })}
      </div>

      <Card className="border-border">
        {tenants.length === 0 ? (
          <EmptyState title={t("noResults")} description={t("noResultsDesc")} icon={Building2} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t("company")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("owner")}</th>
                  <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">{t("plan")}</th>
                  <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">{t("usage")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("status")}</th>
                  <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">{t("createdAt")}</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t_item) => (
                  <tr key={t_item.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/admin/tenants/${t_item.id}`} className="font-medium text-foreground hover:text-brand-accent">{t_item.name}</Link>
                      <p className="text-xs text-muted-foreground">{t_item.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">{t_item.ownerName}</p>
                      <p className="text-xs text-muted-foreground">{t_item.ownerEmail}</p>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {t_item.subscription?.plan ? <PlanBadge name={t_item.subscription.plan.name} isTrial={t_item.subscription.plan.isTrial} isCustom={t_item.subscription.plan.isCustom} /> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                      {t_item._count.employees} {t("emp")} · {t_item._count.branches} {t("br")}
                    </td>
                    <td className="px-4 py-3"><TenantStatusBadge status={t_item.status} /></td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">{new Date(t_item.createdAt).toLocaleDateString()}</td>
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
