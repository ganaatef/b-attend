import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { hasHrPermission, getManagedBranchIds } from "@/lib/hr/permissions";
import {
  Users, Building2, Award, CalendarDays, FileText, AlertTriangle,
  GraduationCap, Package, UserPlus, Wallet, CreditCard, Lock,
  Briefcase, FolderTree, Download, UserMinus,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HrDashboardPage() {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const tid = session.tenantId;
  const t = await getTranslations("hrDashboard");
  const tc = await getTranslations("common");

  const featureCheck = await canUseHrFeature(tid, "hr_core");
  if (!featureCheck.allowed) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="border-dashed border-amber-300 bg-amber-50/40">
          <CardContent className="pt-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-amber-500" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">{t("requiresGrowthPlan")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t("upgradeMessage")}</p>
            <Link href="/billing" className="mt-3 inline-block text-xs text-brand-accent hover:underline">{t("goToBilling")}</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canView = await hasHrPermission("VIEW_HR_DASHBOARD");
  if (!canView) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="border-dashed border-destructive/40">
          <CardContent className="pt-6 text-center">
            <h3 className="text-sm font-semibold text-foreground">{t("accessDenied")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t("noPermission")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isBranchManager = session.role === "BRANCH_MANAGER";
  const isOwnerOrHrAdmin = session.role === "COMPANY_OWNER" || session.role === "HR_ADMIN";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, tid) : [];

  const branchFilter = isBranchManager && managedBranchIds.length > 0
    ? { branchId: { in: managedBranchIds } }
    : {};

  const canViewPayroll = isOwnerOrHrAdmin;
  const canViewSensitive = isOwnerOrHrAdmin;
  const canManageTraining = isOwnerOrHrAdmin || (await hasHrPermission("MANAGE_TRAINING"));
  const canManageAssets = isOwnerOrHrAdmin || (await hasHrPermission("MANAGE_ASSETS"));
  const canExportExcel = await hasHrPermission("EXPORT_HR_EXCEL");

  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalEmployees, activeEmployees, departments, jobTitles,
    onLeaveToday, pendingLeaveRequests, contractsExpiring,
    documentsExpiring, trainingOverdue, assetsAssigned,
    onboardingPending, latestPayrollRun,
    openWarnings, criticalWarnings, trainingDueSoon,
    lostDamagedAssets, offboardingInProgress,
    pendingPayrollAdjustments, missingPayrollProfiles, payrollRunsReadyForReview, lockedPayrollRunsThisYear,
  ] = await Promise.all([
    db.employee.count({ where: { companyId: tid, deletedAt: null, ...branchFilter } }),
    db.employee.count({ where: { companyId: tid, deletedAt: null, status: "ACTIVE", ...branchFilter } }),
    db.department.count({ where: { companyId: tid } }),
    db.jobTitle.count({ where: { companyId: tid, active: true } }),
    db.attendanceDay.count({ where: { companyId: tid, date: today, status: "LEAVE", ...branchFilter } }),
    db.leaveRequest.count({ where: { companyId: tid, status: "PENDING", ...branchFilter } }),
    db.employeeContract.count({ where: { companyId: tid, status: "ACTIVE", endDate: { lte: thirtyDays }, ...branchFilter } }),
    db.employeeDocument.count({ where: { companyId: tid, expiryDate: { lte: thirtyDays }, status: "VALID", ...branchFilter } }),
    db.trainingAssignment.count({ where: { companyId: tid, status: "OVERDUE", ...branchFilter } }),
    db.assetAssignment.count({ where: { companyId: tid, status: "ASSIGNED", ...branchFilter } }),
    db.onboardingTask.count({ where: { companyId: tid, status: "PENDING", ...branchFilter } }),
    db.payrollRun.findFirst({ where: { companyId: tid }, orderBy: { createdAt: "desc" }, select: { status: true, month: true, year: true } }),
    db.employeeWarning.count({ where: { companyId: tid, status: "OPEN", ...branchFilter } }),
    db.employeeWarning.count({ where: { companyId: tid, severity: "CRITICAL", status: { not: "CANCELLED" }, ...branchFilter } }),
    db.trainingAssignment.count({ where: { companyId: tid, status: "ASSIGNED", dueDate: { lte: thirtyDays }, ...branchFilter } }),
    db.asset.count({ where: { companyId: tid, status: { in: ["LOST", "DAMAGED"] } } }),
    db.offboardingTask.count({ where: { companyId: tid, status: { not: "COMPLETED" } } }),
    ...(canViewPayroll ? [
      db.payrollAdjustment.count({ where: { companyId: tid, status: "PENDING" } }),
      db.payrollRunLine.count({ where: { companyId: tid, netAmount: 0, notes: { contains: "WARNING" } } }),
      db.payrollRun.count({ where: { companyId: tid, status: "REVIEW" } }),
      db.payrollRun.count({ where: { companyId: tid, status: "LOCKED", year: new Date().getFullYear() } }),
    ] : [0, 0, 0, 0]),
  ]);

  const cards = [
    { key: "totalEmployees", value: totalEmployees, icon: Users, sub: t("totalEmployeesActive", { count: activeEmployees }), alwaysShow: true },
    { key: "departments", value: departments, icon: FolderTree, sub: t("departmentsJobTitles", { count: jobTitles }), alwaysShow: true },
    { key: "onLeaveToday", value: onLeaveToday, icon: CalendarDays, sub: t("onLeaveTodaySub"), alwaysShow: true },
    { key: "pendingLeave", value: pendingLeaveRequests, icon: FileText, sub: t("pendingLeaveSub"), highlight: pendingLeaveRequests > 0, alwaysShow: true },
    { key: "contractsExpiring", value: contractsExpiring, icon: AlertTriangle, sub: t("contractsExpiringSub"), highlight: contractsExpiring > 0, sensitive: true },
    { key: "documentsExpiring", value: documentsExpiring, icon: FileText, sub: t("documentsExpiringSub"), highlight: documentsExpiring > 0, sensitive: true },
    { key: "trainingOverdue", value: trainingOverdue, icon: GraduationCap, sub: t("trainingOverdueSub"), highlight: trainingOverdue > 0, show: canManageTraining },
    { key: "assetsAssigned", value: assetsAssigned, icon: Package, sub: t("assetsAssignedSub"), show: canManageAssets },
    { key: "onboardingPending", value: onboardingPending, icon: UserPlus, sub: t("onboardingPendingSub"), sensitive: true },
    { key: "openWarnings", value: openWarnings, icon: AlertTriangle, sub: t("openWarningsSub"), highlight: openWarnings > 0, sensitive: true },
    { key: "criticalWarnings", value: criticalWarnings, icon: AlertTriangle, sub: t("criticalWarningsSub"), highlight: criticalWarnings > 0, sensitive: true },
    { key: "trainingDueSoon", value: trainingDueSoon, icon: GraduationCap, sub: t("trainingDueSoonSub"), highlight: trainingDueSoon > 0, show: canManageTraining },
    { key: "lostDamagedAssets", value: lostDamagedAssets, icon: Package, sub: t("lostDamagedAssetsSub"), highlight: lostDamagedAssets > 0, sensitive: true },
    { key: "offboarding", value: offboardingInProgress, icon: UserMinus, sub: t("offboardingSub"), sensitive: true },
    { key: "latestPayroll", value: latestPayrollRun ? latestPayrollRun.status : "—", icon: CreditCard, sub: latestPayrollRun ? `${latestPayrollRun.month}/${latestPayrollRun.year}` : t("noRunsYet"), sensitive: true },
    ...(canViewPayroll ? [
      { key: "payrollReadyForReview", value: payrollRunsReadyForReview, icon: CreditCard, sub: t("payrollReadyForReviewSub"), highlight: payrollRunsReadyForReview > 0, sensitive: true },
      { key: "pendingPayrollAdjustments", value: pendingPayrollAdjustments, icon: CreditCard, sub: t("pendingPayrollAdjustmentsSub"), highlight: pendingPayrollAdjustments > 0, sensitive: true },
      { key: "missingPayrollProfiles", value: missingPayrollProfiles, icon: CreditCard, sub: t("missingPayrollProfilesSub"), highlight: missingPayrollProfiles > 0, sensitive: true },
      { key: "lockedPayrollRuns", value: lockedPayrollRunsThisYear, icon: Lock, sub: t("lockedPayrollRunsSub"), sensitive: true },
    ] : []),
  ];

  const visibleCards = cards.filter((c) => {
    if (c.sensitive) return canViewSensitive;
    if (c.show === false) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{isBranchManager ? t("branchScopedView") : t("allBranches")} · {t("activeCount", { count: activeEmployees })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/employees" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
            <Users className="h-3.5 w-3.5" /> {t("employeesButton")}
          </Link>
          {canExportExcel && (
            <Link href="/api/tenant/hr/employees/excel" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
              <Download className="h-3.5 w-3.5" /> {t("exportExcel")}
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visibleCards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.key} className={c.highlight ? "border-amber-300 bg-amber-50/40" : "border-border"}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{t(c.key as any)}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{c.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("quickLinks")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Link href="/hr/departments" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <FolderTree className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">{t("qlDepartments")}</p>
              <p className="text-xs text-muted-foreground">{t("qlDepartmentsSub", { count: departments })}</p>
            </Link>
            <Link href="/hr/job-titles" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <Award className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">{t("qlJobTitles")}</p>
              <p className="text-xs text-muted-foreground">{t("qlJobTitlesSub", { count: jobTitles })}</p>
            </Link>
            {canViewSensitive && (
              <>
                <Link href="/hr/contracts" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
                  <FileText className="h-4 w-4 text-brand-accent" />
                  <p className="mt-1 font-medium text-foreground">{t("qlContracts")}</p>
                  <p className="text-xs text-muted-foreground">{t("qlContractsSub", { count: contractsExpiring })}</p>
                </Link>
                <Link href="/hr/documents" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
                  <FileText className="h-4 w-4 text-brand-accent" />
                  <p className="mt-1 font-medium text-foreground">{t("qlDocuments")}</p>
                  <p className="text-xs text-muted-foreground">{t("qlDocumentsSub", { count: documentsExpiring })}</p>
                </Link>
              </>
            )}
            <Link href="/hr/leaves" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <CalendarDays className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">{t("qlLeaveManagement")}</p>
              <p className="text-xs text-muted-foreground">{t("qlLeaveManagementSub", { count: pendingLeaveRequests })}</p>
            </Link>
            <Link href="/employees" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <Users className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">{t("qlEmployees")}</p>
              <p className="text-xs text-muted-foreground">{t("qlEmployeesSub", { count: activeEmployees })}</p>
            </Link>
            {canViewSensitive && (
              <Link href="/hr/warnings" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
                <AlertTriangle className="h-4 w-4 text-brand-accent" />
                <p className="mt-1 font-medium text-foreground">{t("qlWarnings")}</p>
                <p className="text-xs text-muted-foreground">{t("qlWarningsSub", { count: openWarnings })}</p>
              </Link>
            )}
            {canManageTraining && (
              <Link href="/hr/training" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
                <GraduationCap className="h-4 w-4 text-brand-accent" />
                <p className="mt-1 font-medium text-foreground">{t("qlTraining")}</p>
                <p className="text-xs text-muted-foreground">{t("qlTrainingSub", { count: trainingOverdue })}</p>
              </Link>
            )}
            {canManageAssets && (
              <Link href="/hr/assets" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
                <Package className="h-4 w-4 text-brand-accent" />
                <p className="mt-1 font-medium text-foreground">{t("qlAssets")}</p>
                <p className="text-xs text-muted-foreground">{t("qlAssetsSub", { count: assetsAssigned })}</p>
              </Link>
            )}
            {canViewSensitive && (
              <>
                <Link href="/hr/onboarding" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
                  <UserPlus className="h-4 w-4 text-brand-accent" />
                  <p className="mt-1 font-medium text-foreground">{t("qlOnboarding")}</p>
                  <p className="text-xs text-muted-foreground">{t("qlOnboardingSub", { count: onboardingPending })}</p>
                </Link>
                <Link href="/hr/offboarding" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
                  <UserMinus className="h-4 w-4 text-brand-accent" />
                  <p className="mt-1 font-medium text-foreground">{t("qlOffboarding")}</p>
                  <p className="text-xs text-muted-foreground">{t("qlOffboardingSub", { count: offboardingInProgress })}</p>
                </Link>
              </>
            )}
            {canViewPayroll && (
              <>
                <Link href="/hr/payroll-profiles" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
                  <Wallet className="h-4 w-4 text-brand-accent" />
                  <p className="mt-1 font-medium text-foreground">{t("qlPayrollProfiles")}</p>
                  <p className="text-xs text-muted-foreground">{t("qlPayrollProfilesSub")}</p>
                </Link>
                <Link href="/hr/payroll-runs" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
                  <CreditCard className="h-4 w-4 text-brand-accent" />
                  <p className="mt-1 font-medium text-foreground">{t("qlPayrollRuns")}</p>
                  <p className="text-xs text-muted-foreground">{t("qlPayrollRunsSub")}</p>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("hrOverview")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                <span className="text-muted-foreground">{t("ovActiveContracts")}</span>
                <span className="font-medium text-foreground">{activeEmployees}</span>
              </div>
              {canViewSensitive && (
                <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{t("ovContractsExpiring")}</span>
                  <span className={`font-medium ${contractsExpiring > 0 ? "text-amber-600" : "text-foreground"}`}>{contractsExpiring}</span>
                </div>
              )}
              {canViewSensitive && (
                <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{t("ovDocumentsExpiring")}</span>
                  <span className={`font-medium ${documentsExpiring > 0 ? "text-amber-600" : "text-foreground"}`}>{documentsExpiring}</span>
                </div>
              )}
              {canManageTraining && (
                <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{t("ovTrainingOverdue")}</span>
                  <span className={`font-medium ${trainingOverdue > 0 ? "text-amber-600" : "text-foreground"}`}>{trainingOverdue}</span>
                </div>
              )}
              {canViewSensitive && (
                <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{t("ovOpenWarnings")}</span>
                  <span className={`font-medium ${openWarnings > 0 ? "text-amber-600" : "text-foreground"}`}>{openWarnings}</span>
                </div>
              )}
              {canViewSensitive && (
                <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{t("ovCriticalWarnings")}</span>
                  <span className={`font-medium ${criticalWarnings > 0 ? "text-amber-600" : "text-foreground"}`}>{criticalWarnings}</span>
                </div>
              )}
              {canManageTraining && (
                <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{t("ovTrainingDueSoon")}</span>
                  <span className={`font-medium ${trainingDueSoon > 0 ? "text-amber-600" : "text-foreground"}`}>{trainingDueSoon}</span>
                </div>
              )}
              {canViewSensitive && (
                <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{t("ovLostDamagedAssets")}</span>
                  <span className={`font-medium ${lostDamagedAssets > 0 ? "text-amber-600" : "text-foreground"}`}>{lostDamagedAssets}</span>
                </div>
              )}
              {canViewSensitive && (
                <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{t("ovOffboarding")}</span>
                  <span className="font-medium text-foreground">{offboardingInProgress}</span>
                </div>
              )}
              {canViewSensitive && (
                <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{t("ovPayrollStatus")}</span>
                  <span className="font-medium text-foreground">{latestPayrollRun?.status ?? "—"}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
