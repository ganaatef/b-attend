import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { formatNumber } from "@/lib/utils";
import {
  generatePayrollLinesAction,
  recalculatePayrollRunAction,
  movePayrollRunToReviewAction,
  approvePayrollRunAction,
  lockPayrollRunAction,
  cancelPayrollRunAction,
  createPayrollAdjustmentAction,
  approvePayrollAdjustmentAction,
  rejectPayrollAdjustmentAction,
  cancelPayrollAdjustmentAction,
  checkPayrollLockReadiness,
} from "../../actions";
import { getTranslations } from "next-intl/server";
import { CreditCard, Lock, CheckCircle, Clock, XCircle, Eye, Download, Info } from "lucide-react";

export const dynamic = "force-dynamic";

const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const statusConfig: Record<string, { label: string; cls: string; icon: typeof CreditCard }> = {
  DRAFT: { label: "Draft", cls: "bg-muted text-muted-foreground border-border", icon: Clock },
  REVIEW: { label: "In Review", cls: "bg-amber-50 text-amber-600 border-amber-200", icon: Eye },
  APPROVED: { label: "Approved", cls: "bg-blue-50 text-blue-600 border-blue-200", icon: CheckCircle },
  LOCKED: { label: "Locked", cls: "bg-brand-success text-white border-transparent", icon: Lock },
  CANCELLED: { label: "Cancelled", cls: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
};

const adjustmentTypeLabels: Record<string, string> = {
  BONUS: "Bonus",
  DEDUCTION: "Deduction",
  ALLOWANCE: "Allowance",
  PENALTY: "Penalty",
  OVERTIME_ADJUSTMENT: "OT Adjustment",
  MANUAL_CORRECTION: "Manual Correction",
};

const adjustmentStatusCls: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600 border-amber-200",
  APPROVED: "bg-brand-success text-white border-transparent",
  REJECTED: "bg-destructive/10 text-destructive border-destructive/20",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

function formatCurrency(n: number) {
  return formatNumber(n) + " EGP";
}

export default async function PayrollRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "BRANCH_MANAGER" || session.role === "EMPLOYEE") return null;
  const { id } = await params;
  const tid = session.tenantId;

  const t = await getTranslations("hrPayrollRuns");

  const canView = hasPerm(session.role, "VIEW_PAYROLL");
  if (!canView) return null;

  const featureCheck = await canUseHrFeature(tid, "hr_payroll");
  if (!featureCheck.allowed) notFound();

  const statusLabel: Record<string, string> = {
    DRAFT: t("draft"),
    REVIEW: t("review"),
    APPROVED: t("approved"),
    LOCKED: t("locked"),
    CANCELLED: t("cancelled"),
  };

  const adjTypeLabel: Record<string, string> = {
    BONUS: t("adjustmentBonus"),
    DEDUCTION: t("adjustmentDeduction"),
    ALLOWANCE: t("adjustmentAllowance"),
    PENALTY: t("adjustmentPenalty"),
    OVERTIME_ADJUSTMENT: t("adjustmentOT"),
    MANUAL_CORRECTION: t("adjustmentManual"),
  };

  const run = await db.payrollRun.findFirst({
    where: { id, companyId: tid },
    include: {
      lines: {
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
        orderBy: { employee: { fullName: "asc" } },
      },
      adjustments: {
        include: {
          employee: { select: { id: true, fullName: true, employeeCode: true } },
        },
        orderBy: { createdAt: "desc" } as any,
      },
    },
  });

  if (!run) notFound();

  const canManage = hasPerm(session.role, "MANAGE_PAYROLL");
  const cfg = statusConfig[run.status] ?? statusConfig.DRAFT;
  const Icon = cfg.icon;

  const totalBaseSalary = run.lines.reduce((s, l) => s + l.baseSalary, 0);
  const totalGrossAdditions = run.lines.reduce((s, l) => s + l.grossAdditions, 0);
  const totalGrossDeductions = run.lines.reduce((s, l) => s + l.grossDeductions, 0);
  const totalNetAmount = run.lines.reduce((s, l) => s + l.netAmount, 0);
  const totalOvertimeHours = run.lines.reduce((s, l) => s + l.overtimeHours, 0);

  const pendingAdjustments = run.adjustments.filter((a) => a.status === "PENDING");
  const showActions = canManage && run.status !== "CANCELLED" && run.status !== "LOCKED";

  const lockReadiness = run.status === "APPROVED"
    ? await checkPayrollLockReadiness(run.id, tid)
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <Link href="/hr/payroll-runs" className="text-xs text-muted-foreground hover:text-foreground">
          ← {t("backToRuns")}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {t("runTitle", { month: monthNames[run.month], year: run.year })}
            </h1>
            <p className="text-sm text-muted-foreground">
              {run.lines.length} employee{run.lines.length !== 1 ? "s" : ""}
              {run.notes && ` · ${run.notes}`}
            </p>
          </div>
          <Badge variant="outline" className={`text-[10px] ${cfg.cls}`}>
            <Icon className="mr-1 h-3 w-3" />
            {statusLabel[run.status] ?? cfg.label}
          </Badge>
        </div>
      </div>

      {showActions && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">{t("actionsCard")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {run.status === "DRAFT" && run.lines.length === 0 && (
              <form action={async () => { "use server"; await generatePayrollLinesAction(run.id); }}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-success px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-success/90">
                  <CreditCard className="h-3.5 w-3.5" /> {t("generateLines")}
                </button>
              </form>
            )}
            {run.status === "DRAFT" && run.lines.length > 0 && (
              <>
                <form action={async () => { "use server"; await recalculatePayrollRunAction(run.id); }}>
                  <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
                    <CreditCard className="h-3.5 w-3.5" /> {t("recalculate")}
                  </button>
                </form>
                <form action={async () => { "use server"; await movePayrollRunToReviewAction(run.id); }}>
                  <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-success px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-success/90">
                    <Eye className="h-3.5 w-3.5" /> {t("moveToReview")}
                  </button>
                </form>
              </>
            )}
            {run.status === "REVIEW" && (
              <form action={async () => { "use server"; await approvePayrollRunAction(run.id); }}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-success px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-success/90">
                  <CheckCircle className="h-3.5 w-3.5" /> {t("approveRun")}
                </button>
              </form>
            )}
            {run.status === "APPROVED" && (
              <form action={async () => { "use server"; await lockPayrollRunAction(run.id); }}>
                <button
                  type="submit"
                  disabled={lockReadiness !== null && !lockReadiness.ready}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white ${
                    lockReadiness !== null && !lockReadiness.ready
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-brand-success hover:bg-brand-success/90"
                  }`}
                >
                  <Lock className="h-3.5 w-3.5" /> {t("lockRun")}
                </button>
              </form>
            )}
            {run.status !== "LOCKED" && run.status !== "CANCELLED" && (
              <form action={async () => { "use server"; await cancelPayrollRunAction(run.id); }}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5">
                  <XCircle className="h-3.5 w-3.5" /> {t("cancelRun")}
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-blue-50/30 border-blue-200">
        <CardContent className="pt-3 pb-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-blue-600">
              {t("taxNote")}
            </p>
          </div>
        </CardContent>
      </Card>

      {lockReadiness && (
        <Card className={`border ${lockReadiness.ready ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/30"}`}>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-start gap-2">
              {lockReadiness.ready ? (
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              ) : (
                <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              )}
              <div className="flex-1">
                <p className={`text-xs font-semibold ${lockReadiness.ready ? "text-emerald-700" : "text-amber-700"}`}>
                  {lockReadiness.ready
                    ? t("lockReady")
                    : t("resolveItems")}
                </p>
                {!lockReadiness.ready && (
                  <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[10px]">
                    {lockReadiness.pendingAdjustments > 0 && (
                      <p className="text-amber-600">{t("pendingAdjustments")} {lockReadiness.pendingAdjustments}</p>
                    )}
                    {lockReadiness.pendingApprovalRequests > 0 && (
                      <p className="text-amber-600">{t("pendingApprovalRequests")} {lockReadiness.pendingApprovalRequests}</p>
                    )}
                    {lockReadiness.attendanceRequiresApproval > 0 && (
                      <p className="text-amber-600">{t("attendanceRequiringApproval")} {lockReadiness.attendanceRequiresApproval}</p>
                    )}
                    {lockReadiness.pendingAttendanceStatuses > 0 && (
                      <p className="text-amber-600">{t("missingClockOut")} {lockReadiness.pendingAttendanceStatuses}</p>
                    )}
                    {lockReadiness.pendingLeaveRequests > 0 && (
                      <p className="text-amber-600">{t("pendingLeaveRequests")} {lockReadiness.pendingLeaveRequests}</p>
                    )}
                    {lockReadiness.missingPayrollProfiles > 0 && (
                      <p className="text-amber-600">{t("missingPayrollProfiles")} {lockReadiness.missingPayrollProfiles}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{run.lines.length}</p>
          <p className="text-xs text-muted-foreground">{t("employeesMetric")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalBaseSalary)}</p>
          <p className="text-xs text-muted-foreground">{t("baseSalaryMetric")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{totalOvertimeHours.toFixed(1)}h</p>
          <p className="text-xs text-muted-foreground">{t("overtimeHoursMetric")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-brand-success">{formatCurrency(totalGrossAdditions)}</p>
          <p className="text-xs text-muted-foreground">{t("additionsMetric")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-destructive">{formatCurrency(totalGrossDeductions)}</p>
          <p className="text-xs text-muted-foreground">{t("deductionsMetric")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalNetAmount)}</p>
          <p className="text-xs text-muted-foreground">{t("netAmountMetric")}</p>
        </Card>
      </div>

      {run.status === "LOCKED" && (
        <div className="flex items-center gap-2">
          <Link
            href={`/api/tenant/hr/payroll-runs/${run.id}/excel`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40"
          >
            <Download className="h-3.5 w-3.5" /> {t("exportExcel")}
          </Link>
        </div>
      )}

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">
            {t("linesCard", { count: run.lines.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {run.lines.length === 0 ? (
            <EmptyState title={t("noLines")} icon={CreditCard} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">{t("tableEmployee")}</th>
                    <th className="pb-2 pr-4 font-medium">{t("tableCode")}</th>
                    <th className="pb-2 pr-4 font-medium">{t("tableBranch")}</th>
                    <th className="pb-2 pr-4 font-medium">{t("tableDept")}</th>
                    <th className="pb-2 pr-4 font-medium text-right">{t("tableSchd")}</th>
                    <th className="pb-2 pr-4 font-medium text-right">{t("tablePres")}</th>
                    <th className="pb-2 pr-4 font-medium text-right">{t("tableAbs")}</th>
                    <th className="pb-2 pr-4 font-medium text-right">{t("tableLeave")}</th>
                    <th className="pb-2 pr-4 font-medium text-right">{t("tableOff")}</th>
                    <th className="pb-2 pr-4 font-medium text-right">{t("tableHours")}</th>
                    <th className="pb-2 pr-4 font-medium text-right">{t("tableOtHrs")}</th>
                    <th className="pb-2 pr-4 font-medium text-right">{t("tableLate")}</th>
                    <th className="pb-2 pr-4 font-medium text-right">{t("tableBaseSalary")}</th>
                    <th className="pb-2 pr-4 font-medium text-right">{t("tableAdditions")}</th>
                    <th className="pb-2 pr-4 font-medium text-right">{t("tableDeductions")}</th>
                    <th className="pb-2 font-medium text-right">{t("tableNet")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {run.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-muted/20">
                      <td className="py-2 pr-4 font-medium text-foreground">{line.employee.fullName}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{line.employee.employeeCode}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{line.employee.branch?.name ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{line.employee.department?.name ?? "—"}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{line.scheduledDays}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{line.presentDays}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{line.absentDays}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{line.leaveDays}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{line.offDays}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{line.workedHours.toFixed(1)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{line.overtimeHours.toFixed(1)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{line.lateMinutes}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatCurrency(line.baseSalary)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-brand-success">
                        {line.grossAdditions > 0 ? formatCurrency(line.grossAdditions) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-destructive">
                        {line.grossDeductions > 0 ? formatCurrency(line.grossDeductions) : "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums font-medium">{formatCurrency(line.netAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-medium text-foreground">
                    <td className="pt-2 pr-4" colSpan={4}>{t("totals")}</td>
                    <td className="pt-2 pr-4 text-right tabular-nums">{run.lines.reduce((s, l) => s + l.scheduledDays, 0)}</td>
                    <td className="pt-2 pr-4 text-right tabular-nums">{run.lines.reduce((s, l) => s + l.presentDays, 0)}</td>
                    <td className="pt-2 pr-4 text-right tabular-nums">{run.lines.reduce((s, l) => s + l.absentDays, 0)}</td>
                    <td className="pt-2 pr-4 text-right tabular-nums">{run.lines.reduce((s, l) => s + l.leaveDays, 0)}</td>
                    <td className="pt-2 pr-4 text-right tabular-nums">{run.lines.reduce((s, l) => s + l.offDays, 0)}</td>
                    <td className="pt-2 pr-4 text-right tabular-nums">{run.lines.reduce((s, l) => s + l.workedHours, 0).toFixed(1)}</td>
                    <td className="pt-2 pr-4 text-right tabular-nums">{totalOvertimeHours.toFixed(1)}</td>
                    <td className="pt-2 pr-4 text-right tabular-nums">{run.lines.reduce((s, l) => s + l.lateMinutes, 0)}</td>
                    <td className="pt-2 pr-4 text-right tabular-nums">{formatCurrency(totalBaseSalary)}</td>
                    <td className="pt-2 pr-4 text-right tabular-nums text-brand-success">{formatCurrency(totalGrossAdditions)}</td>
                    <td className="pt-2 pr-4 text-right tabular-nums text-destructive">{formatCurrency(totalGrossDeductions)}</td>
                    <td className="pt-2 text-right tabular-nums">{formatCurrency(totalNetAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">
            {t("adjustmentsCard", { count: run.adjustments.length })}
            {pendingAdjustments.length > 0 && (
              <span className="ml-2 text-[10px] text-amber-600">({pendingAdjustments.length} pending)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManage && run.status !== "LOCKED" && run.status !== "CANCELLED" && (
            <form
              action={async (formData) => {
                "use server";
                await createPayrollAdjustmentAction({}, formData);
              }}
              className="grid gap-2 sm:grid-cols-5 items-end"
            >
              <input type="hidden" name="payrollRunId" value={run.id} />
              <div className="space-y-1">
                <Label htmlFor="adj-employeeId" className="text-[10px]">{t("formEmployeeId")}</Label>
                <Input id="adj-employeeId" name="employeeId" required placeholder={t("formEmployeeId")} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="adj-type" className="text-[10px]">{t("formType")}</Label>
                <select id="adj-type" name="type" required className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs">
                  <option value="BONUS">{t("adjustmentBonus")}</option>
                  <option value="DEDUCTION">{t("adjustmentDeduction")}</option>
                  <option value="ALLOWANCE">{t("adjustmentAllowance")}</option>
                  <option value="PENALTY">{t("adjustmentPenalty")}</option>
                  <option value="OVERTIME_ADJUSTMENT">{t("adjustmentOT")}</option>
                  <option value="MANUAL_CORRECTION">{t("adjustmentManual")}</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="adj-amount" className="text-[10px]">{t("formAmount")}</Label>
                <Input id="adj-amount" name="amount" type="number" min="1" required placeholder="0" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="adj-reason" className="text-[10px]">{t("formReason")}</Label>
                <Input id="adj-reason" name="reason" required placeholder={t("formReason")} className="h-8 text-xs" />
              </div>
              <div>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90">
                  {t("addAdjustment")}
                </button>
              </div>
            </form>
          )}

          {run.adjustments.length === 0 ? (
            <EmptyState title={t("noAdjustments")} icon={CreditCard} />
          ) : (
            <div className="divide-y divide-border/60">
              {run.adjustments.map((adj) => (
                <div key={adj.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {adj.employee.fullName} ({adj.employee.employeeCode})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {adjTypeLabel[adj.type] ?? adj.type} · {formatCurrency(adj.amount)}
                      {adj.reason && ` · ${adj.reason}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${adjustmentStatusCls[adj.status] ?? ""}`}>
                      {adj.status}
                    </Badge>
                    {canManage && adj.status === "PENDING" && run.status !== "LOCKED" && (
                      <div className="flex gap-1">
                        <form action={async () => { "use server"; await approvePayrollAdjustmentAction(adj.id); }}>
                          <button type="submit" className="inline-flex items-center gap-1 rounded-md bg-brand-success px-2 py-1 text-[10px] font-medium text-white hover:bg-brand-success/90">
                            <CheckCircle className="h-3 w-3" /> {t("approveRun")}
                          </button>
                        </form>
                        <form action={async () => { "use server"; await rejectPayrollAdjustmentAction(adj.id); }}>
                          <button type="submit" className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-[10px] font-medium text-destructive hover:bg-destructive/5">
                            <XCircle className="h-3 w-3" /> {t("rejectRun")}
                          </button>
                        </form>
                        <form action={async () => { "use server"; await cancelPayrollAdjustmentAction(adj.id); }}>
                          <button type="submit" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-foreground hover:bg-muted/40">
                            {t("cancelRun")}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
