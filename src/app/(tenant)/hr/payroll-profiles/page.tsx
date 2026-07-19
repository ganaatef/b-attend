import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { Wallet, Plus, Lock } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { displayPaymentMethod } from "@/lib/locale-display";
import { getLocaleCode } from "@/lib/locale";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function PayrollProfilesListPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; department?: string; salaryType?: string }>;
}) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "BRANCH_MANAGER" || session.role === "EMPLOYEE") return null;
  const tid = session.tenantId;
  const sp = await searchParams;

  const t = await getTranslations("hrPayrollProfiles");
  const tc = await getTranslations("common");
  const th = await getTranslations("hrDashboard");
  const locale = await getLocaleCode();

  const canView = hasPerm(session.role, "VIEW_PAYROLL");
  const canManage = hasPerm(session.role, "MANAGE_PAYROLL");
  if (!canView && !canManage) return null;

  const featureCheck = await canUseHrFeature(tid, "hr_payroll");
  if (!featureCheck.allowed) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Card className="border-dashed border-amber-300 bg-amber-50/40">
          <div className="pt-6 pb-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-amber-500" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">{th("requiresGrowthPlan")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{featureCheck.reason ?? th("upgradeMessage")}</p>
          </div>
        </Card>
      </div>
    );
  }

  const where: any = { companyId: tid };

  if (sp.branch) {
    where.employee = { ...where.employee, branchId: sp.branch };
  }
  if (sp.department) {
    where.employee = { ...where.employee, departmentId: sp.department };
  }
  if (sp.salaryType) {
    where.salaryType = sp.salaryType;
  }

  const [profiles, branches, departments] = await Promise.all([
    db.payrollProfile.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            branch: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.branch.findMany({ where: { companyId: tid, deletedAt: null }, orderBy: { name: "asc" } }),
    db.department.findMany({ where: { companyId: tid }, orderBy: { name: "asc" } }),
  ]);

  const totalCount = profiles.length;
  const activeCount = profiles.filter((p) => p.active).length;
  const monthlyCount = profiles.filter((p) => p.salaryType === "MONTHLY").length;
  const dailyCount = profiles.filter((p) => p.salaryType === "DAILY").length;
  const hourlyCount = profiles.filter((p) => p.salaryType === "HOURLY").length;

  const salaryTypeBadge = (type: string) => {
    switch (type) {
      case "MONTHLY":
        return <Badge variant="default" className="text-xs bg-blue-50 text-blue-600 border-blue-200">{t("monthly")}</Badge>;
      case "DAILY":
        return <Badge variant="outline" className="text-xs">{t("daily")}</Badge>;
      case "HOURLY":
        return <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">{t("hourly")}</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{type}</Badge>;
    }
  };

  const buildHref = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    if (overrides.branch !== undefined ? overrides.branch : sp.branch) params.set("branch", overrides.branch ?? sp.branch!);
    if (overrides.department !== undefined ? overrides.department : sp.department) params.set("department", overrides.department ?? sp.department!);
    if (overrides.salaryType !== undefined ? overrides.salaryType : sp.salaryType) params.set("salaryType", overrides.salaryType ?? sp.salaryType!);
    const qs = params.toString();
    return `/hr/payroll-profiles${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("profilesSummary", { total: totalCount, active: activeCount })}</p>
        </div>
        {canManage && (
          <Link href="/hr/payroll-profiles/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90">
            <Plus className="h-3.5 w-3.5" /> {t("newProfile")}
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{totalCount}</p>
          <p className="text-xs text-muted-foreground">{t("totalProfiles")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{activeCount}</p>
          <p className="text-xs text-muted-foreground">{tc("active")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{monthlyCount}</p>
          <p className="text-xs text-muted-foreground">{t("monthly")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{dailyCount}</p>
          <p className="text-xs text-muted-foreground">{t("daily")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{hourlyCount}</p>
          <p className="text-xs text-muted-foreground">{t("hourly")}</p>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <form method="GET" action="/hr/payroll-profiles" className="flex flex-wrap items-end gap-2">
            <CardTitle className="text-sm font-semibold text-foreground mr-2 mb-1">{t("filtersLabel")}</CardTitle>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t("branch")}</label>
              <select name="branch" defaultValue={sp.branch || ""} className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs">
                <option value="">{t("allBranches")}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t("department")}</label>
              <select name="department" defaultValue={sp.department || ""} className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs">
                <option value="">{t("allDepartments")}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">{t("salaryType")}</label>
              <select name="salaryType" defaultValue={sp.salaryType || ""} className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs">
                <option value="">{t("allTypes")}</option>
                <option value="MONTHLY">{t("monthly")}</option>
                <option value="DAILY">{t("daily")}</option>
                <option value="HOURLY">{t("hourly")}</option>
              </select>
            </div>
            <button type="submit" className="h-8 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted/40">{t("apply")}</button>
          </form>
        </CardHeader>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">{t("profilesCount", { count: profiles.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <EmptyState title={t("noProfilesYet")} description={t("noProfilesDesc")} icon={Wallet} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="pb-2 pr-4">{t("employee")}</th>
                    <th className="pb-2 pr-4">{t("code")}</th>
                    <th className="pb-2 pr-4">{t("branch")}</th>
                    <th className="pb-2 pr-4">{t("department")}</th>
                    <th className="pb-2 pr-4">{t("salaryType")}</th>
                    <th className="pb-2 pr-4">{t("baseSalary")}</th>
                    <th className="pb-2 pr-4">{t("paymentMethod")}</th>
                    <th className="pb-2">{tc("status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {profiles.map((p) => (
                    <tr key={p.id} className="text-foreground">
                      <td className="py-3 pr-4">
                        <Link href={`/hr/payroll-profiles/${p.employeeId}`} className="font-medium hover:text-brand-accent">
                          {p.employee.fullName}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">{p.employee.employeeCode}</td>
                      <td className="py-3 pr-4 text-xs">{p.employee.branch?.name ?? "—"}</td>
                      <td className="py-3 pr-4 text-xs">{p.employee.department?.name ?? "—"}</td>
                      <td className="py-3 pr-4">{salaryTypeBadge(p.salaryType)}</td>
                      <td className="py-3 pr-4 text-xs font-medium">{formatNumber(p.baseSalary)} {p.currency}</td>
                      <td className="py-3 pr-4 text-xs">{displayPaymentMethod(p.paymentMethod, locale)}</td>
                      <td className="py-3">
                        {p.active ? (
                          <Badge variant="default" className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200">{tc("active")}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">{tc("inactive")}</Badge>
                        )}
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
