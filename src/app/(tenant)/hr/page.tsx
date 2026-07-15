import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
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

  const featureCheck = await canUseHrFeature(tid, "hr_core");
  if (!featureCheck.allowed) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="border-dashed border-amber-300 bg-amber-50/40">
          <CardContent className="pt-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-amber-500" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">HR Module requires Growth plan or higher</h3>
            <p className="mt-1 text-xs text-muted-foreground">{featureCheck.reason ?? "Upgrade your plan to access HR features."}</p>
            <Link href="/billing" className="mt-3 inline-block text-xs text-brand-accent hover:underline">Go to Billing →</Link>
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
            <h3 className="text-sm font-semibold text-foreground">Access Denied</h3>
            <p className="mt-1 text-xs text-muted-foreground">You do not have permission to view the HR dashboard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isBranchManager = session.role === "BRANCH_MANAGER";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, tid) : [];

  const branchFilter = isBranchManager && managedBranchIds.length > 0
    ? { branchId: { in: managedBranchIds } }
    : {};

  const canViewPayroll = (session.role === "COMPANY_OWNER" || session.role === "HR_ADMIN") && !isBranchManager;

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
    { label: "Total employees", value: totalEmployees, icon: Users, sub: `${activeEmployees} active` },
    { label: "Departments", value: departments, icon: FolderTree, sub: `${jobTitles} job titles` },
    { label: "On leave today", value: onLeaveToday, icon: CalendarDays, sub: "Employees on leave" },
    { label: "Pending leave requests", value: pendingLeaveRequests, icon: FileText, sub: "Awaiting approval", highlight: pendingLeaveRequests > 0 },
    { label: "Contracts expiring (30d)", value: contractsExpiring, icon: AlertTriangle, sub: "Need renewal", highlight: contractsExpiring > 0 },
    { label: "Documents expiring (30d)", value: documentsExpiring, icon: FileText, sub: "Need renewal", highlight: documentsExpiring > 0 },
    { label: "Training overdue", value: trainingOverdue, icon: GraduationCap, sub: "Assignments overdue", highlight: trainingOverdue > 0 },
    { label: "Assets assigned", value: assetsAssigned, icon: Package, sub: "Active assignments" },
    { label: "Onboarding pending", value: onboardingPending, icon: UserPlus, sub: "Tasks to complete" },
    { label: "Open warnings", value: openWarnings, icon: AlertTriangle, sub: "Warnings to review", highlight: openWarnings > 0 },
    { label: "Critical warnings", value: criticalWarnings, icon: AlertTriangle, sub: "Require attention", highlight: criticalWarnings > 0 },
    { label: "Training due soon", value: trainingDueSoon, icon: GraduationCap, sub: "Due within 30 days", highlight: trainingDueSoon > 0 },
    { label: "Lost/damaged assets", value: lostDamagedAssets, icon: Package, sub: "Need attention", highlight: lostDamagedAssets > 0 },
    { label: "Offboarding", value: offboardingInProgress, icon: UserMinus, sub: "In progress" },
    { label: "Latest payroll", value: latestPayrollRun ? latestPayrollRun.status : "—", icon: CreditCard, sub: latestPayrollRun ? `${latestPayrollRun.month}/${latestPayrollRun.year}` : "No runs yet" },
    ...(canViewPayroll ? [
      { label: "Payroll ready for review", value: payrollRunsReadyForReview, icon: CreditCard, sub: "Runs awaiting approval", highlight: payrollRunsReadyForReview > 0 },
      { label: "Pending payroll adjustments", value: pendingPayrollAdjustments, icon: CreditCard, sub: "Adjustments awaiting approval", highlight: pendingPayrollAdjustments > 0 },
      { label: "Missing payroll profiles", value: missingPayrollProfiles, icon: CreditCard, sub: "Employees without profile", highlight: missingPayrollProfiles > 0 },
      { label: "Locked payroll runs (YTD)", value: lockedPayrollRunsThisYear, icon: Lock, sub: "Read-only finalized runs" },
    ] : []),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">HR Dashboard</h1>
          <p className="text-sm text-muted-foreground">{isBranchManager ? "Branch-scoped view" : "All branches"} · {activeEmployees} active employees</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/employees" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
            <Users className="h-3.5 w-3.5" /> Employees
          </Link>
          <Link href="/api/tenant/hr/employees/excel" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
            <Download className="h-3.5 w-3.5" /> Export Excel
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className={c.highlight ? "border-amber-300 bg-amber-50/40" : "border-border"}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
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
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Quick links</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Link href="/hr/departments" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <FolderTree className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">Departments</p>
              <p className="text-[10px] text-muted-foreground">{departments} total</p>
            </Link>
            <Link href="/hr/job-titles" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <Award className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">Job Titles</p>
              <p className="text-[10px] text-muted-foreground">{jobTitles} active</p>
            </Link>
            <Link href="/hr/contracts" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <FileText className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">Contracts</p>
              <p className="text-[10px] text-muted-foreground">{contractsExpiring} expiring soon</p>
            </Link>
            <Link href="/hr/documents" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <FileText className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">Documents</p>
              <p className="text-[10px] text-muted-foreground">{documentsExpiring} expiring soon</p>
            </Link>
            <Link href="/hr/leaves" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <CalendarDays className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">Leave Management</p>
              <p className="text-[10px] text-muted-foreground">{pendingLeaveRequests} pending</p>
            </Link>
            <Link href="/employees" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <Users className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">Employees</p>
              <p className="text-[10px] text-muted-foreground">{activeEmployees} active</p>
            </Link>
            <Link href="/hr/warnings" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <AlertTriangle className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">Warnings</p>
              <p className="text-[10px] text-muted-foreground">{openWarnings} open</p>
            </Link>
            <Link href="/hr/training" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <GraduationCap className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">Training</p>
              <p className="text-[10px] text-muted-foreground">{trainingOverdue} overdue</p>
            </Link>
            <Link href="/hr/assets" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <Package className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">Assets</p>
              <p className="text-[10px] text-muted-foreground">{assetsAssigned} assigned</p>
            </Link>
            <Link href="/hr/onboarding" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <UserPlus className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">Onboarding</p>
              <p className="text-[10px] text-muted-foreground">{onboardingPending} pending</p>
            </Link>
            <Link href="/hr/offboarding" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <UserMinus className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">Offboarding</p>
              <p className="text-[10px] text-muted-foreground">{offboardingInProgress} in progress</p>
            </Link>
            {canViewPayroll && (
              <>
                <Link href="/hr/payroll-profiles" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
                  <Wallet className="h-4 w-4 text-brand-accent" />
                  <p className="mt-1 font-medium text-foreground">Payroll Profiles</p>
                  <p className="text-[10px] text-muted-foreground">Manage salary profiles</p>
                </Link>
                <Link href="/hr/payroll-runs" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
                  <CreditCard className="h-4 w-4 text-brand-accent" />
                  <p className="mt-1 font-medium text-foreground">Payroll Runs</p>
                  <p className="text-[10px] text-muted-foreground">Generate and manage runs</p>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">HR Overview</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                <span className="text-muted-foreground">Active contracts</span>
                <span className="font-medium text-foreground">{activeEmployees}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                <span className="text-muted-foreground">Contracts expiring soon</span>
                <span className={`font-medium ${contractsExpiring > 0 ? "text-amber-600" : "text-foreground"}`}>{contractsExpiring}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                <span className="text-muted-foreground">Documents expiring soon</span>
                <span className={`font-medium ${documentsExpiring > 0 ? "text-amber-600" : "text-foreground"}`}>{documentsExpiring}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                <span className="text-muted-foreground">Training overdue</span>
                <span className={`font-medium ${trainingOverdue > 0 ? "text-amber-600" : "text-foreground"}`}>{trainingOverdue}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                <span className="text-muted-foreground">Open warnings</span>
                <span className={`font-medium ${openWarnings > 0 ? "text-amber-600" : "text-foreground"}`}>{openWarnings}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                <span className="text-muted-foreground">Critical warnings</span>
                <span className={`font-medium ${criticalWarnings > 0 ? "text-amber-600" : "text-foreground"}`}>{criticalWarnings}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                <span className="text-muted-foreground">Training due soon</span>
                <span className={`font-medium ${trainingDueSoon > 0 ? "text-amber-600" : "text-foreground"}`}>{trainingDueSoon}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                <span className="text-muted-foreground">Lost/damaged assets</span>
                <span className={`font-medium ${lostDamagedAssets > 0 ? "text-amber-600" : "text-foreground"}`}>{lostDamagedAssets}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                <span className="text-muted-foreground">Offboarding in progress</span>
                <span className="font-medium text-foreground">{offboardingInProgress}</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                <span className="text-muted-foreground">Payroll status</span>
                <span className="font-medium text-foreground">{latestPayrollRun?.status ?? "—"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
