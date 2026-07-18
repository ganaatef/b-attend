/**
 * /admin/ai — Super Admin AI controls.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Brain, Activity, ToggleRight, Building2 } from "lucide-react";
import { AiSettingsForm } from "./AiSettingsForm";
import { toggleTenantAiAction } from "./actions";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminAiPage() {
  const t = await getTranslations("adminAi");
  const [settings, usageLogs, tenantsWithAi] = await Promise.all([
    db.systemSetting.findFirst({ where: { isMain: true } }),
    db.aiUsageLog.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { tenant: true } }),
    db.tenant.findMany({ include: { tenantAiSetting: true, subscription: { include: { plan: true } } }, orderBy: { name: "asc" } }),
  ]);

  if (!settings) return <div className="p-4 text-sm text-muted-foreground">{t("systemSettingsNotInit")}</div>;

  const stats = {
    total: usageLogs.length,
    success: usageLogs.filter((l) => l.status === "SUCCESS").length,
    failed: usageLogs.filter((l) => l.status === "FAILED").length,
    byFeature: usageLogs.reduce((acc, l) => { acc[l.feature] = (acc[l.feature] ?? 0) + 1; return acc; }, {} as Record<string, number>),
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2"><Brain className="h-4 w-4 text-brand-accent" /><CardTitle className="text-sm font-semibold text-foreground">{t("globalAiSettings")}</CardTitle></div>
        </CardHeader>
        <CardContent><AiSettingsForm settings={settings} /></CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-brand-accent" /><CardTitle className="text-sm font-semibold text-foreground">{t("perTenantAiStatus")}</CardTitle></div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Tenant</th>
                  <th className="px-3 py-2 text-left font-medium">Plan</th>
                  <th className="px-3 py-2 text-left font-medium">AI enabled</th>
                  <th className="px-3 py-2 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {tenantsWithAi.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <Link href={`/admin/tenants/${tenant.id}`} className="font-medium text-foreground hover:text-brand-accent">{tenant.name}</Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{tenant.subscription?.plan?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant={(tenant.tenantAiSetting?.aiEnabled ?? true) ? "default" : "secondary"} className={(tenant.tenantAiSetting?.aiEnabled ?? true) ? "bg-brand-success text-white border-transparent text-xs" : "text-xs"}>
                        {(tenant.tenantAiSetting?.aiEnabled ?? true) ? t("enabled") : t("disabled")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <form action={async () => { "use server"; await toggleTenantAiAction(tenant.id, !(tenant.tenantAiSetting?.aiEnabled ?? true)); }}>
                        <button type="submit" className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-muted">
                          <ToggleRight className="h-3 w-3" /> {(tenant.tenantAiSetting?.aiEnabled ?? true) ? t("disable") : t("enable")}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-brand-accent" /><CardTitle className="text-sm font-semibold text-foreground">{t("aiUsageLogs")}</CardTitle></div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>{t("total")}: <strong className="text-foreground">{stats.total}</strong></span>
              <span>{t("success")}: <strong className="text-brand-success">{stats.success}</strong></span>
              <span>{t("failed")}: <strong className="text-destructive">{stats.failed}</strong></span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {usageLogs.length === 0 ? <EmptyState title={t("noAiUsage")} icon={Activity} /> : (
            <div className="max-h-96 overflow-y-auto battend-scroll">
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-border bg-card text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">When</th>
                    <th className="px-3 py-2 text-left font-medium">Tenant</th>
                    <th className="px-3 py-2 text-left font-medium">{t("feature")}</th>
                    <th className="px-3 py-2 text-left font-medium">{t("provider")}</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usageLogs.map((l) => (
                    <tr key={l.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                      <td className="px-3 py-2 text-xs text-foreground">{l.tenant?.name ?? "—"}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{l.feature.replace(/_/g, " ")}</Badge></td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{l.provider}</td>
                      <td className="px-3 py-2"><Badge variant={l.status === "SUCCESS" ? "default" : l.status === "FAILED" ? "destructive" : "secondary"} className={l.status === "SUCCESS" ? "bg-brand-success text-white border-transparent text-[10px]" : "text-[10px]"}>{l.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("aiFeatureUsage")}</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(stats.byFeature).length === 0 ? <p className="text-sm text-muted-foreground">{t("noUsageData")}</p> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Object.entries(stats.byFeature).map(([k, v]) => (
                <div key={k} className="rounded-md border border-border bg-card p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{v}</p>
                  <p className="text-xs text-muted-foreground">{k.replace(/_/g, " ")}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
