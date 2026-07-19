import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { deactivatePayrollProfileAction } from "../../actions";
import { Wallet } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function PayrollProfileDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const t = await getTranslations("hrPayrollProfiles");
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "BRANCH_MANAGER" || session.role === "EMPLOYEE") return null;
  if (!hasPerm(session.role, "VIEW_PAYROLL")) return null;
  const tid = session.tenantId;

  const featureCheck = await canUseHrFeature(tid, "hr_payroll");
  if (!featureCheck.allowed) notFound();

  const { employeeId } = await params;

  const profile = await db.payrollProfile.findFirst({
    where: { employeeId, companyId: tid },
    include: {
      employee: {
        include: {
          branch: { select: { name: true } },
          department: { select: { name: true } },
        },
      },
    },
  });
  if (!profile) notFound();

  const canManage = hasPerm(session.role, "MANAGE_PAYROLL");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/payroll-profiles" className="text-xs text-muted-foreground hover:text-foreground">{t("backToProfiles")}</Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">{t("payrollProfile")}</h1>
            <p className="text-sm text-muted-foreground">{profile.employee.fullName} ({profile.employee.employeeCode})</p>
          </div>
          <div className="flex items-center gap-2">
            {profile.active ? (
              <Badge variant="default" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200">{t("activeBadge")}</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">{t("inactiveBadge")}</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("employeeLabel")}</p>
          <p className="text-sm font-semibold text-foreground">{profile.employee.fullName}</p>
          <p className="text-[10px] text-muted-foreground">{profile.employee.employeeCode}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("branchLabel")}</p>
          <p className="text-sm font-semibold text-foreground">{profile.employee.branch?.name ?? "—"}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("departmentLabel")}</p>
          <p className="text-sm font-semibold text-foreground">{profile.employee.department?.name ?? "—"}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("salaryTypeLabel")}</p>
          <p className="text-sm font-semibold text-foreground">{profile.salaryType}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("baseSalaryLabel")}</p>
          <p className="text-sm font-semibold text-foreground">{formatNumber(profile.baseSalary)} {profile.currency}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("paymentMethodLabel")}</p>
          <p className="text-sm font-semibold text-foreground">{profile.paymentMethod.replace(/_/g, " ")}</p>
        </Card>
      </div>

      {(profile.bankName || profile.bankAccount || profile.walletNumber) && (
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-foreground">{t("paymentDetails")}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {profile.bankName && (
                <div>
                  <p className="text-xs text-muted-foreground">{t("bankNameLabel")}</p>
                  <p className="text-sm font-semibold text-foreground">{profile.bankName}</p>
                </div>
              )}
              {profile.bankAccount && (
                <div>
                  <p className="text-xs text-muted-foreground">{t("bankAccountLabel")}</p>
                  <p className="text-sm font-semibold text-foreground">{profile.bankAccount}</p>
                </div>
              )}
              {profile.walletNumber && (
                <div>
                  <p className="text-xs text-muted-foreground">{t("walletNumberLabel")}</p>
                  <p className="text-sm font-semibold text-foreground">{profile.walletNumber}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {profile.dailyRate != null && (
          <Card className="border-border p-4">
            <p className="text-xs text-muted-foreground">{t("dailyRateLabel")}</p>
            <p className="text-sm font-semibold text-foreground">{formatNumber(profile.dailyRate)} {profile.currency}</p>
          </Card>
        )}
        {profile.hourlyRate != null && (
          <Card className="border-border p-4">
            <p className="text-xs text-muted-foreground">{t("hourlyRateLabel")}</p>
            <p className="text-sm font-semibold text-foreground">{formatNumber(profile.hourlyRate)} {profile.currency}</p>
          </Card>
        )}
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("overtimeMultiplier")}</p>
          <p className="text-sm font-semibold text-foreground">{profile.overtimeRateMultiplier}x</p>
        </Card>
      </div>

      {(profile.lateDeductionRule || profile.absenceDeductionRule) && (
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-foreground">{t("deductionRules")}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">{t("lateDeductionRule")}</p>
                <p className="text-sm font-semibold text-foreground">{profile.lateDeductionRule ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("absenceDeductionRule")}</p>
                <p className="text-sm font-semibold text-foreground">{profile.absenceDeductionRule ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border p-4">
        <p className="text-xs text-muted-foreground">{t("createdLabel")}</p>
        <p className="text-sm font-semibold text-foreground">{new Date(profile.createdAt).toLocaleDateString()}</p>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("linksCard")}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link
            href={`/employees/${profile.employeeId}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
          >
            {t("employeeProfile")}
          </Link>
          {canManage && (
            <>
              <Link
                href={`/hr/payroll-profiles/${profile.employeeId}/edit`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
              >
                {t("editProfile")}
              </Link>
              {profile.active && (
                <form action={async () => {
                  "use server";
                  await deactivatePayrollProfileAction(profile.id);
                }}>
                  <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5">
                    {t("deactivateBtn")}
                  </button>
                </form>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
