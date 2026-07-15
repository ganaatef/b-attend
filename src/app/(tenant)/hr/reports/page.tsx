import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import {
  FileBarChart, Users, FileText, ClipboardList, CalendarDays,
  AlertTriangle, GraduationCap, Package, UserPlus, UserMinus,
  Wallet, CreditCard, Download, Lock, BarChart3,
} from "lucide-react";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

interface ReportCard {
  id: string;
  title: string;
  description: string;
  icon: typeof FileBarChart;
  permission: HrPermission | null;
  featureGate: string | null;
  href: string;
  count: number;
  color: string;
}

export default async function HRReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;

  const tid = session.tenantId;
  const sp = await searchParams;
  const activeType = sp.type;

  const isBranchManager = session.role === "BRANCH_MANAGER";
  const canViewPayroll = !isBranchManager && hasPerm(session.role, "VIEW_PAYROLL");
  const canManagePayroll = !isBranchManager && hasPerm(session.role, "MANAGE_PAYROLL");
  const canExport = hasPerm(session.role, "EXPORT_HR_EXCEL");

  const featureCheck = await canUseHrFeature(tid, "hr_core");
  if (!featureCheck.allowed) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Card className="border-dashed border-amber-300 bg-amber-50/40">
          <div className="pt-6 pb-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-amber-500" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">HR Reports require HR module</h3>
            <p className="mt-1 text-xs text-muted-foreground">{featureCheck.reason ?? "Upgrade to access HR reports."}</p>
          </div>
        </Card>
      </div>
    );
  }

  const excelFeature = await canUseHrFeature(tid, "hr_excel_export");
  const canExcel = excelFeature.allowed || (await canUseHrFeature(tid, "excel_export")).allowed;

  const branchFilter = isBranchManager
    ? { branch: { managerId: session.sub } }
    : {};

  const [
    employeeCount,
    contractCount,
    expiringContracts,
    documentCount,
    expiredDocuments,
    missingDocuments,
    leaveBalanceCount,
    pendingLeaves,
    warningCount,
    trainingCount,
    overdueTraining,
    assetCount,
    assignedAssets,
    onboardingCount,
    offboardingCount,
    payrollProfileCount,
    payrollRunCount,
    lockedPayrollRuns,
  ] = await Promise.all([
    db.employee.count({ where: { companyId: tid, deletedAt: null, status: "ACTIVE", ...branchFilter } }),
    db.employeeContract.count({ where: { companyId: tid, status: "ACTIVE" } }),
    db.employeeContract.count({ where: { companyId: tid, status: "ACTIVE", endDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } } }),
    db.employeeDocument.count({ where: { companyId: tid } }),
    db.employeeDocument.count({ where: { companyId: tid, status: "EXPIRED" } }),
    db.employeeDocument.count({ where: { companyId: tid, status: "MISSING" } }),
    db.leaveBalance.count({ where: { companyId: tid } }),
    db.leaveRequest.count({ where: { companyId: tid, status: "PENDING" } }),
    db.employeeWarning.count({ where: { companyId: tid } }),
    db.trainingAssignment.count({ where: { companyId: tid } }),
    db.trainingAssignment.count({ where: { companyId: tid, status: "OVERDUE" } }),
    db.asset.count({ where: { companyId: tid } }),
    db.assetAssignment.count({ where: { companyId: tid, status: "ASSIGNED" } }),
    db.onboardingTask.count({ where: { companyId: tid } }),
    db.offboardingTask.count({ where: { companyId: tid } }),
    db.payrollProfile.count({ where: { companyId: tid, active: true } }),
    db.payrollRun.count({ where: { companyId: tid } }),
    db.payrollRun.count({ where: { companyId: tid, status: "LOCKED" } }),
  ]);

  const reports: ReportCard[] = [
    {
      id: "employee-master",
      title: "Employee Master Report",
      description: "Complete employee directory with status, department, branch, and employment details.",
      icon: Users,
      permission: null,
      featureGate: "hr_core",
      href: "/api/tenant/hr/reports/excel?type=employee-master",
      count: employeeCount,
      color: "text-blue-600",
    },
    {
      id: "headcount",
      title: "Headcount Report",
      description: "Headcount summary grouped by branch, department, job title, and employment type.",
      icon: BarChart3,
      permission: null,
      featureGate: "hr_core",
      href: "/api/tenant/hr/reports/excel?type=headcount",
      count: employeeCount,
      color: "text-blue-600",
    },
    {
      id: "contracts-expiry",
      title: "Contracts Expiry Report",
      description: "Active contracts nearing expiry with risk levels and days until expiry.",
      icon: FileText,
      permission: "MANAGE_CONTRACTS",
      featureGate: "hr_core",
      href: "/api/tenant/hr/reports/excel?type=contracts-expiry",
      count: expiringContracts,
      color: "text-amber-600",
    },
    {
      id: "documents-expiry",
      title: "Documents Expiry Report",
      description: "Employee documents with expiry dates and validity status.",
      icon: ClipboardList,
      permission: "MANAGE_DOCUMENTS",
      featureGate: "hr_documents",
      href: "/api/tenant/hr/reports/excel?type=documents-expiry",
      count: expiredDocuments,
      color: "text-amber-600",
    },
    {
      id: "missing-documents",
      title: "Missing Documents Report",
      description: "Employees with missing required documents.",
      icon: ClipboardList,
      permission: "MANAGE_DOCUMENTS",
      featureGate: "hr_documents",
      href: "/api/tenant/hr/reports/excel?type=missing-documents",
      count: missingDocuments,
      color: "text-destructive",
    },
    {
      id: "leave-balance",
      title: "Leave Balance Report",
      description: "Leave balances by employee, leave type, and year with usage summary.",
      icon: CalendarDays,
      permission: null,
      featureGate: "hr_leave",
      href: "/api/tenant/hr/reports/excel?type=leave-balance",
      count: leaveBalanceCount,
      color: "text-emerald-600",
    },
    {
      id: "leave-usage",
      title: "Leave Usage Report",
      description: "Leave request history with approval status and duration details.",
      icon: CalendarDays,
      permission: null,
      featureGate: "hr_leave",
      href: "/api/tenant/hr/reports/excel?type=leave-usage",
      count: pendingLeaves,
      color: "text-emerald-600",
    },
    {
      id: "warnings",
      title: "Warnings Report",
      description: "Employee warnings by type, severity, and status with acknowledgment tracking.",
      icon: AlertTriangle,
      permission: "MANAGE_WARNINGS",
      featureGate: "hr_core",
      href: "/api/tenant/hr/reports/excel?type=warnings",
      count: warningCount,
      color: "text-orange-600",
    },
    {
      id: "training",
      title: "Training Report",
      description: "Training assignments, completion rates, scores, and overdue tracking.",
      icon: GraduationCap,
      permission: "MANAGE_TRAINING",
      featureGate: "hr_training",
      href: "/api/tenant/hr/reports/excel?type=training",
      count: trainingCount,
      color: "text-violet-600",
    },
    {
      id: "assets",
      title: "Assets Report",
      description: "Asset inventory with assignment status, conditions, and employee allocation.",
      icon: Package,
      permission: "MANAGE_ASSETS",
      featureGate: "hr_assets",
      href: "/api/tenant/hr/reports/excel?type=assets",
      count: assetCount,
      color: "text-cyan-600",
    },
    {
      id: "onboarding",
      title: "Onboarding Report",
      description: "Onboarding task progress with completion rates and overdue tracking.",
      icon: UserPlus,
      permission: "MANAGE_ONBOARDING",
      featureGate: "hr_core",
      href: "/api/tenant/hr/reports/excel?type=onboarding",
      count: onboardingCount,
      color: "text-teal-600",
    },
    {
      id: "offboarding",
      title: "Offboarding Report",
      description: "Offboarding task progress with finalization status and access disabling.",
      icon: UserMinus,
      permission: "MANAGE_OFFBOARDING",
      featureGate: "hr_core",
      href: "/api/tenant/hr/reports/excel?type=offboarding",
      count: offboardingCount,
      color: "text-rose-600",
    },
    {
      id: "payroll-profiles",
      title: "Payroll Profile Report",
      description: "Payroll profiles with salary types, payment methods, and active status.",
      icon: Wallet,
      permission: "VIEW_PAYROLL",
      featureGate: "hr_payroll",
      href: "/api/tenant/hr/reports/excel?type=payroll-profiles",
      count: payrollProfileCount,
      color: "text-indigo-600",
    },
    {
      id: "payroll-runs",
      title: "Payroll Run Summary Report",
      description: "Payroll run history with status, totals, approval, and lock tracking.",
      icon: CreditCard,
      permission: "VIEW_PAYROLL",
      featureGate: "hr_payroll",
      href: "/api/tenant/hr/reports/excel?type=payroll-runs",
      count: payrollRunCount,
      color: "text-indigo-600",
    },
  ];

  const visibleReports = reports.filter((r) => {
    if (isBranchManager) {
      if (r.permission === "VIEW_PAYROLL" || r.permission === "MANAGE_PAYROLL") return false;
      if (r.id === "offboarding") return false;
    }
    if (r.permission && !hasPerm(session.role, r.permission)) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">HR Reports</h1>
          <p className="text-sm text-muted-foreground">
            {visibleReports.length} reports available
            {isBranchManager && " · Branch-scoped view"}
          </p>
        </div>
        {canExcel && (
          <Link
            href="/api/tenant/hr/reports/excel?type=all"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90"
          >
            <Download className="h-3.5 w-3.5" /> Export All Reports
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleReports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="border-border hover:shadow-sm transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-muted`}>
                      <Icon className={`h-4 w-4 ${report.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold text-foreground">{report.title}</CardTitle>
                      {report.permission && (
                        <Badge variant="outline" className="text-[9px] mt-0.5">
                          {report.permission}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-lg font-bold text-foreground">{report.count}</span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-[11px] text-muted-foreground mb-3">{report.description}</p>
                <div className="flex items-center gap-2">
                  {canExcel && (
                    <Link
                      href={report.href}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[10px] font-medium text-foreground hover:bg-muted/40"
                    >
                      <Download className="h-3 w-3" /> Excel
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {visibleReports.length === 0 && (
        <EmptyState
          title="No reports available"
          description="You don't have permission to view any HR reports."
          icon={FileBarChart}
        />
      )}
    </div>
  );
}
