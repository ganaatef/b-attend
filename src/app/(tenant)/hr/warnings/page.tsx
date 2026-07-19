import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getTranslations, getLocale } from "next-intl/server";
import { getStatusLabel } from "@/lib/status-labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { AlertTriangle, Eye, Plus, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function WarningsListPage({ searchParams }: { searchParams: Promise<{ branch?: string; severity?: string; status?: string }> }) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE" || session.role === "BRANCH_MANAGER") return null;
  const tid = session.tenantId;
  const t = await getTranslations("hrWarnings");
  const locale = await getLocale();

  const featureCheck = await canUseHrFeature(tid, "hr_core");
  if (!featureCheck.allowed) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Card className="border-dashed border-amber-300 bg-amber-50/40">
          <div className="pt-6 pb-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-amber-500" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">{t("featureGateTitle")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{featureCheck.reason ?? t("upgradeMessage")}</p>
          </div>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const canManage = hasPerm(session.role, "MANAGE_WARNINGS");
  const isBranchManager = session.role === "BRANCH_MANAGER";

  let managedBranchIds: string[] = [];
  if (isBranchManager) {
    const { getManagedBranchIds } = await import("@/lib/hr/permissions");
    managedBranchIds = await getManagedBranchIds(session.sub, tid);
  }

  const where: any = { companyId: tid };

  if (isBranchManager && managedBranchIds.length > 0) {
    where.branchId = sp.branch && managedBranchIds.includes(sp.branch) ? sp.branch : { in: managedBranchIds };
  } else if (sp.branch) {
    where.branchId = sp.branch;
  }

  if (sp.severity) {
    where.severity = sp.severity;
  }

  if (sp.status) {
    where.status = sp.status;
  }

  const [warnings, branches, totals, openCount, ackCount, resolvedCount, criticalCount] = await Promise.all([
    db.employeeWarning.findMany({
      where,
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true, branch: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.branch.findMany({ where: { companyId: tid, deletedAt: null }, orderBy: { name: "asc" } }),
    db.employeeWarning.count({ where: { companyId: tid } }),
    db.employeeWarning.count({ where: { companyId: tid, status: "OPEN" } }),
    db.employeeWarning.count({ where: { companyId: tid, status: "ACKNOWLEDGED" } }),
    db.employeeWarning.count({ where: { companyId: tid, status: "RESOLVED" } }),
    db.employeeWarning.count({ where: { companyId: tid, severity: "CRITICAL" } }),
  ]);

  const severityBadge = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
      case "HIGH":
        return <Badge variant="destructive" className="text-[10px]">{getStatusLabel(sev, locale)}</Badge>;
      case "MEDIUM":
        return <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">{getStatusLabel(sev, locale)}</Badge>;
      case "LOW":
        return <Badge variant="default" className="text-[10px]">{getStatusLabel(sev, locale)}</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{getStatusLabel(sev, locale)}</Badge>;
    }
  };

  const statusBadge = (st: string) => {
    switch (st) {
      case "OPEN":
        return <Badge variant="outline" className="text-[10px]">{getStatusLabel(st, locale)}</Badge>;
      case "ACKNOWLEDGED":
        return <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200">{getStatusLabel(st, locale)}</Badge>;
      case "RESOLVED":
        return <Badge variant="default" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200">{getStatusLabel(st, locale)}</Badge>;
      case "CANCELLED":
        return <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">{getStatusLabel(st, locale)}</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{getStatusLabel(st, locale)}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">{t("listTitle")}</h1>
          <p className="text-sm text-muted-foreground">{openCount} open · {ackCount} acknowledged · {criticalCount} critical</p>
        </div>
        {canManage && (
          <Link href="/hr/warnings/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90">
            <Plus className="h-3.5 w-3.5" /> {t("newWarning")}
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{totals}</p>
          <p className="text-xs text-muted-foreground">{t("totalWarnings")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{openCount}</p>
          <p className="text-xs text-muted-foreground">{t("openCount")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{ackCount}</p>
          <p className="text-xs text-muted-foreground">{t("acknowledgedCount")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{resolvedCount}</p>
          <p className="text-xs text-muted-foreground">{t("resolvedCount")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{criticalCount}</p>
          <p className="text-xs text-muted-foreground">{t("criticalSeverity")}</p>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <form method="GET" action="/hr/warnings" className="flex flex-wrap items-end gap-2">
            <CardTitle className="text-sm font-semibold text-foreground mr-2 mb-1">{t("filters")}</CardTitle>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Branch</label>
              <select name="branch" defaultValue={sp.branch || ""} className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs">
                <option value="">{t("allBranches")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Severity</label>
              <select name="severity" defaultValue={sp.severity || ""} className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs">
                <option value="">{t("allSeverity")}</option>
                <option value="LOW">{getStatusLabel("LOW", locale)}</option>
                <option value="MEDIUM">{getStatusLabel("MEDIUM", locale)}</option>
                <option value="HIGH">{getStatusLabel("HIGH", locale)}</option>
                <option value="CRITICAL">{getStatusLabel("CRITICAL", locale)}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Status</label>
              <select name="status" defaultValue={sp.status || ""} className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs">
                <option value="">{t("allStatus")}</option>
                <option value="OPEN">{getStatusLabel("OPEN", locale)}</option>
                <option value="ACKNOWLEDGED">{getStatusLabel("ACKNOWLEDGED", locale)}</option>
                <option value="RESOLVED">{getStatusLabel("RESOLVED", locale)}</option>
                <option value="CANCELLED">{getStatusLabel("CANCELLED", locale)}</option>
              </select>
            </div>
            <button type="submit" className="h-8 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted/40">{t("apply")}</button>
          </form>
        </CardHeader>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">{t("warningsCount", { count: warnings.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {warnings.length === 0 ? (
            <EmptyState title={t("noWarningsFound")} icon={AlertTriangle} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="pb-2 pr-4">{t("tableEmployee")}</th>
                    <th className="pb-2 pr-4">{t("tableType")}</th>
                    <th className="pb-2 pr-4">{t("tableSeverity")}</th>
                    <th className="pb-2 pr-4">{t("tableDate")}</th>
                    <th className="pb-2 pr-4">{t("tableStatus")}</th>
                    <th className="pb-2 text-right">{t("tableActions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {warnings.map((w) => (
                    <tr key={w.id} className="text-foreground">
                      <td className="py-3 pr-4">
                        <p className="font-medium">{w.employee.fullName}</p>
                        <p className="text-[10px] text-muted-foreground">{w.employee.employeeCode} · {w.employee.branch?.name ?? "—"}</p>
                      </td>
                      <td className="py-3 pr-4 text-xs">{w.type.replace(/_/g, " ")}</td>
                      <td className="py-3 pr-4">{severityBadge(w.severity)}</td>
                      <td className="py-3 pr-4 text-xs">{new Date(w.date).toLocaleDateString()}</td>
                      <td className="py-3 pr-4">{statusBadge(w.status)}</td>
                      <td className="py-3 text-right">
                        <Link href={`/hr/warnings/${w.id}`} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-foreground hover:bg-muted/40">
                          <Eye className="h-3 w-3" /> {t("view")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
