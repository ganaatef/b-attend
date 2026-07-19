/** /employees/[id] — Enhanced employee profile with 10 permission-aware HR tabs */
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { formatNumber, formatDateTime } from "@/lib/utils";
import { getRolePermissions, getManagedBranchIds, type HrPermission } from "@/lib/hr/permissions";
import { approveLeaveRequestAction, rejectLeaveRequestAction } from "@/app/(tenant)/hr/actions";
import {
  User as UserIcon, Clock, ClipboardList, FileText, CalendarDays,
  GraduationCap, Package, AlertTriangle, Wallet, ScrollText, Lock,
  UserPlus, UserMinus,
} from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { getStatusLabel } from "@/lib/status-labels";
import { displayEmploymentType, displayPunchType, displayDocumentType, displayContractType, displayWarningType, displayPaymentMethod, displayAuditAction } from "@/lib/locale-display";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("employees");
  const tA = await getTranslations("approvals");
  const locale = await getLocale();
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const { id } = await params;
  const tid = session.tenantId;
  const role = session.role;

  const employee = await db.employee.findFirst({
    where: { id, companyId: tid, deletedAt: null },
    include: { branch: true, department: true, jobTitleRef: true, defaultShiftPolicy: true, user: true },
  });
  if (!employee) notFound();

  const isSelf = session.sub === employee.userId;
  const isBranchManager = role === "BRANCH_MANAGER";
  const isOwnerOrHr = role === "COMPANY_OWNER" || role === "HR_ADMIN";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, tid) : [];
  const inManagedBranch = isBranchManager && employee.branchId && managedBranchIds.includes(employee.branchId);

  const canViewSensitive = hasPerm(role, "VIEW_EMPLOYEE_SENSITIVE_DATA");
  const canViewPayroll = hasPerm(role, "VIEW_PAYROLL") || hasPerm(role, "MANAGE_PAYROLL");
  const canApproveLeave = hasPerm(role, "APPROVE_LEAVE");
  const canManageWarnings = hasPerm(role, "MANAGE_WARNINGS");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentYear = now.getFullYear();

  const [
    attendanceDays, punches, requests, documents, contracts,
    leaveBalances, leaveRequests, trainingAssignments, assetAssignments,
    warnings, payrollProfile, auditLogs, onboardingTasks, offboardingTasks,
    recentPayrollLines, recentAdjustments,
  ] = await Promise.all([
    db.attendanceDay.findMany({ where: { employeeId: id, date: { gte: monthStart } }, orderBy: { date: "desc" }, take: 31 }),
    db.punch.findMany({ where: { employeeId: id }, orderBy: { timestamp: "desc" }, take: 20 }),
    db.approvalRequest.findMany({ where: { employeeId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.employeeDocument.findMany({ where: { employeeId: id }, orderBy: { createdAt: "desc" } }),
    db.employeeContract.findMany({ where: { employeeId: id }, orderBy: { startDate: "desc" } }),
    db.leaveBalance.findMany({ where: { employeeId: id, year: currentYear }, include: { leaveType: true } }),
    db.leaveRequest.findMany({ where: { employeeId: id }, include: { leaveType: { select: { name: true, code: true, paid: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.trainingAssignment.findMany({ where: { employeeId: id }, include: { course: true }, orderBy: { createdAt: "desc" } }),
    db.assetAssignment.findMany({ where: { employeeId: id }, include: { asset: true }, orderBy: { createdAt: "desc" } }),
    db.employeeWarning.findMany({ where: { employeeId: id }, orderBy: { date: "desc" } }),
    db.payrollProfile.findUnique({ where: { employeeId: id } }),
    db.auditLog.findMany({ where: { entityId: id, companyId: tid }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.onboardingTask.findMany({ where: { employeeId: id }, orderBy: { createdAt: "desc" } }),
    db.offboardingTask.findMany({ where: { employeeId: id }, orderBy: { createdAt: "desc" } }),
    db.payrollRunLine.findMany({ where: { employeeId: id, companyId: tid }, include: { payrollRun: { select: { month: true, year: true, status: true } } }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.payrollAdjustment.findMany({ where: { employeeId: id, companyId: tid }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const present = attendanceDays.filter((a) => ["ON_TIME", "LATE", "OVERTIME", "EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"].includes(a.status)).length;
  const absent = attendanceDays.filter((a) => a.status === "ABSENT").length;
  const totalLate = attendanceDays.reduce((s, a) => s + a.lateMinutes, 0);
  const totalWorked = attendanceDays.reduce((s, a) => s + a.workedMinutes, 0);

  const tabs = ["overview", "attendance"];
  if (isOwnerOrHr || (isBranchManager && inManagedBranch && false)) tabs.push("documents");
  if (isOwnerOrHr) tabs.push("contracts");
  if (isOwnerOrHr || canApproveLeave || isSelf) tabs.push("leave");
  if (isOwnerOrHr || isBranchManager) tabs.push("training");
  if (isOwnerOrHr || isBranchManager) tabs.push("assets");
  if (isOwnerOrHr || (canManageWarnings && (isBranchManager ? inManagedBranch : true))) tabs.push("warnings");
  if (isOwnerOrHr) tabs.push("payroll");
  if (isOwnerOrHr) tabs.push("onboarding");
  if (isOwnerOrHr) tabs.push("offboarding");
  if (isOwnerOrHr) tabs.push("audit");

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <Link href="/employees" className="text-xs text-muted-foreground hover:text-foreground">{t("backToList")}</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">{employee.fullName}</h1>
        <p className="text-sm text-muted-foreground">{employee.employeeCode} · {employee.jobTitleRef?.title ?? employee.jobTitle ?? "—"}</p>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant={employee.status === "ACTIVE" ? "default" : "destructive"} className={employee.status === "ACTIVE" ? "bg-brand-success text-white border-transparent" : ""}>{getStatusLabel(employee.status, locale)}</Badge>
          <Badge variant="outline">{displayEmploymentType(employee.employmentType, locale)}</Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{t("branch")}</p><p className="text-sm font-semibold text-foreground">{employee.branch?.name ?? "—"}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{t("department")}</p><p className="text-sm font-semibold text-foreground">{employee.department?.name ?? "—"}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{t("phone")}</p><p className="text-sm font-semibold text-foreground">{employee.phone ?? "—"}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{t("email")}</p><p className="text-sm font-semibold text-foreground truncate">{employee.email ?? "—"}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">{t("tabOverview")}</TabsTrigger>
          <TabsTrigger value="attendance">{t("tabAttendance")}</TabsTrigger>
          {(isOwnerOrHr) && <TabsTrigger value="documents">{t("tabDocuments")}</TabsTrigger>}
          {isOwnerOrHr && <TabsTrigger value="contracts">{t("tabContracts")}</TabsTrigger>}
          {(isOwnerOrHr || canApproveLeave || isSelf) && <TabsTrigger value="leave">{t("tabLeave")}</TabsTrigger>}
          {(isOwnerOrHr || isBranchManager) && <TabsTrigger value="training">{t("tabTraining")}</TabsTrigger>}
          {(isOwnerOrHr || isBranchManager) && <TabsTrigger value="assets">{t("tabAssets")}</TabsTrigger>}
          {(isOwnerOrHr || canManageWarnings) && <TabsTrigger value="warnings">{t("tabWarnings")}</TabsTrigger>}
          {isOwnerOrHr && canViewPayroll && <TabsTrigger value="payroll">{t("tabPayroll")}</TabsTrigger>}
          {isOwnerOrHr && <TabsTrigger value="onboarding">{t("tabOnboarding")}</TabsTrigger>}
          {isOwnerOrHr && <TabsTrigger value="offboarding">{t("tabOffboarding")}</TabsTrigger>}
          {isOwnerOrHr && <TabsTrigger value="audit">{t("tabAudit")}</TabsTrigger>}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("profileTab")}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">{t("employeeCode")}</span> <span className="font-medium">{employee.employeeCode}</span></div>
                <div><span className="text-muted-foreground">{t("fullNameLabel")}</span> <span className="font-medium">{employee.fullName}</span></div>
                {employee.arabicName && <div><span className="text-muted-foreground">{t("arabicNameLabel")}</span> <span className="font-medium">{employee.arabicName}</span></div>}
                <div><span className="text-muted-foreground">{t("phone")}</span> <span className="font-medium">{employee.phone ?? "—"}</span></div>
                <div><span className="text-muted-foreground">{t("email")}</span> <span className="font-medium">{employee.email ?? "—"}</span></div>
                {canViewSensitive && employee.nationalId && <div><span className="text-muted-foreground">{t("nationalIdLabel")}</span> <span className="font-medium">{employee.nationalId}</span></div>}
                <div><span className="text-muted-foreground">{t("branch")}</span> <span className="font-medium">{employee.branch?.name ?? "—"}</span></div>
                <div><span className="text-muted-foreground">{t("department")}</span> <span className="font-medium">{employee.department?.name ?? "—"}</span></div>
                <div><span className="text-muted-foreground">{t("jobTitleLabel")}</span> <span className="font-medium">{employee.jobTitleRef?.title ?? employee.jobTitle ?? "—"}</span></div>
                <div><span className="text-muted-foreground">{t("employmentTypeLabel")}</span> <span className="font-medium">{displayEmploymentType(employee.employmentType, locale)}</span></div>
                <div><span className="text-muted-foreground">{t("startDateLabel")}</span> <span className="font-medium">{employee.startDate ? new Date(employee.startDate).toLocaleDateString() : "—"}</span></div>
                <div><span className="text-muted-foreground">{t("statusLabel")}</span> <span className="font-medium">{getStatusLabel(employee.status, locale)}</span></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("monthlySummary")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-4">
                <div><p className="text-2xl font-bold text-foreground">{present}</p><p className="text-xs text-muted-foreground">{t("presentDays")}</p></div>
                <div><p className="text-2xl font-bold text-foreground">{absent}</p><p className="text-xs text-muted-foreground">{t("absentDays")}</p></div>
                <div><p className="text-2xl font-bold text-foreground">{totalLate}</p><p className="text-xs text-muted-foreground">{t("lateMinutes")}</p></div>
                <div><p className="text-2xl font-bold text-foreground">{Math.floor(totalWorked / 60)}h</p><p className="text-xs text-muted-foreground">{t("workedHours")}</p></div>
              </div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">{t("recentPunches")}</h4>
              {punches.length === 0 ? <EmptyState title={t("noPunches")} icon={Clock} /> : (
                <div className="max-h-72 space-y-1.5 overflow-y-auto battend-scroll">
                  {punches.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                       <div><p className="font-medium text-foreground">{displayPunchType(p.type, locale)}</p><p className="text-muted-foreground">{formatDateTime(p.timestamp)}</p></div>
                      <div className="text-right"><p className="text-muted-foreground">{p.source}</p><p className="text-muted-foreground">{p.insideGeofence ? t("inGeofence") : t("outsideGeofence")}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">{t("documentsTitle")}</CardTitle>
                {isOwnerOrHr && (
                  <Link href="/hr/documents" className="text-xs text-brand-accent hover:underline">{t("manage")}</Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? <EmptyState title={t("noDocuments")} icon={FileText} /> : (
                <div className="space-y-1.5">
                  {documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                      <div>
                         <p className="font-medium text-foreground">{displayDocumentType(d.documentType, locale)}</p>
                        <p className="text-muted-foreground">{d.documentNumber ?? "—"} {d.expiryDate ? `· Expires ${new Date(d.expiryDate).toLocaleDateString()}` : ""}</p>
                      </div>
                      <Badge variant={d.status === "VALID" ? "default" : d.status === "EXPIRED" ? "destructive" : "outline"} className={d.status === "VALID" ? "bg-brand-success text-white border-transparent" : ""}>{getStatusLabel(d.status, locale)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contracts */}
        <TabsContent value="contracts">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">{t("contractsTitle")}</CardTitle>
                {isOwnerOrHr && (
                  <Link href="/hr/contracts" className="text-xs text-brand-accent hover:underline">{t("manage")}</Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {contracts.length === 0 ? <EmptyState title={t("noContracts")} icon={FileText} /> : (
                <div className="space-y-1.5">
                  {contracts.map((c) => (
                    <Link key={c.id} href={`/hr/contracts/${c.id}`} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs hover:bg-muted/20 transition-colors">
                      <div>
                        <p className="font-medium text-foreground">{c.contractNumber}</p>
                         <p className="text-muted-foreground">{displayContractType(c.contractType, locale)} · <bdi dir="ltr">{new Date(c.startDate).toLocaleDateString(locale)} — {c.endDate ? new Date(c.endDate).toLocaleDateString(locale) : (locale === "ar" ? "مفتوح" : "Open")}</bdi></p>
                      </div>
                      <Badge variant={c.status === "ACTIVE" ? "default" : "outline"} className={c.status === "ACTIVE" ? "bg-brand-success text-white border-transparent" : ""}>{getStatusLabel(c.status, locale)}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave */}
        <TabsContent value="leave">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("leaveBalancesTitle", { year: currentYear })}</CardTitle></CardHeader>
              <CardContent>
                {leaveBalances.length === 0 ? <EmptyState title={t("noLeaveBalances")} icon={CalendarDays} /> : (
                  <div className="space-y-1.5">
                    {leaveBalances.map((lb) => (
                      <div key={lb.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                        <div>
                          <p className="font-medium text-foreground">{lb.leaveType.name}</p>
                          <p className="text-muted-foreground">{lb.leaveType.code} · {lb.leaveType.paid ? t("paid") : t("unpaid")}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-foreground">{lb.remaining}/{lb.openingBalance} {t("daysLabel")}</p>
                          <p className="text-muted-foreground">{t("usedLabel")} {lb.used} · {t("pendingLabel")} {lb.pending}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("leaveRequestsTitle")}</CardTitle></CardHeader>
              <CardContent>
                {leaveRequests.length === 0 ? <EmptyState title={t("noLeaveRequests")} icon={CalendarDays} /> : (
                  <div className="space-y-1.5">
                    {leaveRequests.map((lr) => (
                      <div key={lr.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                        <div>
                          <p className="font-medium text-foreground">{lr.leaveType.name} · {lr.daysCount} day{lr.daysCount > 1 ? "s" : ""}</p>
                          <p className="text-muted-foreground">{new Date(lr.startDate).toLocaleDateString()} — {new Date(lr.endDate).toLocaleDateString()}</p>
                          {lr.reason && <p className="text-muted-foreground truncate max-w-[250px]">{lr.reason}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={lr.status === "APPROVED" ? "default" : lr.status === "REJECTED" ? "destructive" : lr.status === "PENDING" ? "outline" : "outline"} className={lr.status === "APPROVED" ? "bg-brand-success text-white border-transparent" : ""}>{getStatusLabel(lr.status, locale)}</Badge>
                          {canApproveLeave && lr.status === "PENDING" && (
                            <div className="flex gap-1">
                              <form action={async () => { "use server"; await approveLeaveRequestAction(lr.id); }}>
                                <button type="submit" className="rounded bg-brand-success px-1.5 py-0.5 text-xs text-white hover:bg-brand-success/90">{tA("approve")}</button>
                              </form>
                              <form action={async () => { "use server"; await rejectLeaveRequestAction(lr.id); }}>
                                <button type="submit" className="rounded border border-destructive/30 px-1.5 py-0.5 text-xs text-destructive hover:bg-destructive/5">{tA("reject")}</button>
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
        </TabsContent>

        {/* Training */}
        <TabsContent value="training">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("trainingAssignmentsTitle")}</CardTitle></CardHeader>
            <CardContent>
              {trainingAssignments.length === 0 ? <EmptyState title={t("noTrainingAssignments")} icon={GraduationCap} /> : (
                <div className="space-y-1.5">
                  {trainingAssignments.map((ta) => (
                    <div key={ta.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                      <div>
                        <p className="font-medium text-foreground">{ta.course?.title ?? "—"}</p>
                        <p className="text-muted-foreground">{t("scoreLabel")} {ta.score ?? "—"}</p>
                      </div>
                      <Badge variant={ta.status === "COMPLETED" ? "default" : ta.status === "OVERDUE" ? "destructive" : "outline"} className={ta.status === "COMPLETED" ? "bg-brand-success text-white border-transparent" : ""}>{getStatusLabel(ta.status, locale)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assets */}
        <TabsContent value="assets">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("assignedAssetsTitle")}</CardTitle></CardHeader>
            <CardContent>
              {assetAssignments.length === 0 ? <EmptyState title={t("noAssetsAssigned")} icon={Package} /> : (
                <div className="space-y-1.5">
                  {assetAssignments.map((aa) => (
                    <div key={aa.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                      <div>
                        <p className="font-medium text-foreground">{aa.asset?.name ?? "—"}</p>
                        <p className="text-muted-foreground">{aa.asset?.code ?? "—"} · {aa.asset?.type ?? "—"}</p>
                      </div>
                      <Badge variant={aa.status === "ASSIGNED" ? "default" : "outline"}>{getStatusLabel(aa.status, locale)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Warnings */}
        <TabsContent value="warnings">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("warningsTitle")}</CardTitle></CardHeader>
            <CardContent>
              {warnings.length === 0 ? <EmptyState title={t("noWarnings")} icon={AlertTriangle} /> : (
                <div className="space-y-1.5">
                  {warnings.map((w) => (
                    <div key={w.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                      <div>
                         <p className="font-medium text-foreground">{displayWarningType(w.type, locale)}</p>
                        <p className="text-muted-foreground">{w.reason} · {new Date(w.date).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={w.severity === "CRITICAL" || w.severity === "HIGH" ? "destructive" : "outline"}>{getStatusLabel(w.severity, locale)}</Badge>
                        <Badge variant="outline">{getStatusLabel(w.status, locale)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll */}
        <TabsContent value="payroll">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-foreground">{t("payrollProfileTitle")}</CardTitle>
                  {isOwnerOrHr && <Link href="/hr/payroll-profiles" className="text-xs text-brand-accent hover:underline">{t("manage")}</Link>}
                </div>
              </CardHeader>
              <CardContent>
                {!payrollProfile ? <EmptyState title={t("noPayrollProfile")} icon={Wallet} /> : (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">{t("baseSalary")}</span> <span className="font-medium">{payrollProfile.baseSalary ? formatNumber(payrollProfile.baseSalary) : ""} {payrollProfile.currency}</span></div>
                    <div><span className="text-muted-foreground">{t("salaryType")}</span> <span className="font-medium">{payrollProfile.salaryType}</span></div>
                     <div><span className="text-muted-foreground">{t("paymentMethod")}</span> <span className="font-medium">{payrollProfile.paymentMethod ? displayPaymentMethod(payrollProfile.paymentMethod, locale) : "—"}</span></div>
                    <div><span className="text-muted-foreground">{t("overtimeRate")}</span> <span className="font-medium">{payrollProfile.overtimeRateMultiplier}x</span></div>
                    {payrollProfile.dailyRate && <div><span className="text-muted-foreground">{t("dailyRate")}</span> <span className="font-medium">{formatNumber(payrollProfile.dailyRate)} {payrollProfile.currency}</span></div>}
                    {payrollProfile.hourlyRate && <div><span className="text-muted-foreground">{t("hourlyRate")}</span> <span className="font-medium">{formatNumber(payrollProfile.hourlyRate)} {payrollProfile.currency}</span></div>}
                    <div><span className="text-muted-foreground">{t("statusLabel")}</span> <Badge variant={payrollProfile.active ? "default" : "outline"} className={payrollProfile.active ? "bg-brand-success text-white border-transparent" : ""}>{payrollProfile.active ? t("active") : t("inactive")}</Badge></div>
                  </div>
                )}
              </CardContent>
            </Card>

            {recentPayrollLines.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("recentPayrollLines")}</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {recentPayrollLines.map((line) => (
                      <div key={line.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                        <div>
                          <p className="font-medium text-foreground">{line.payrollRun.month}/{line.payrollRun.year}</p>
                          <p className="text-muted-foreground">Base: {formatNumber(line.baseSalary)} {t("currencyLabel")} · Net: {formatNumber(line.netAmount)} {t("currencyLabel")}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{line.payrollRun.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {recentAdjustments.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("recentAdjustments")}</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {recentAdjustments.map((adj) => (
                      <div key={adj.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                        <div>
                           <p className="font-medium text-foreground">{getStatusLabel(adj.type, locale)} — {formatNumber(adj.amount)} {t("currencyLabel")}</p>
                          <p className="text-muted-foreground truncate max-w-[300px]">{adj.reason ?? t("noReason")}</p>
                        </div>
                        <Badge variant={adj.status === "APPROVED" ? "default" : adj.status === "REJECTED" ? "destructive" : "outline"} className={adj.status === "APPROVED" ? "bg-brand-success text-white border-transparent" : ""}>{adj.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Onboarding */}
        <TabsContent value="onboarding">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">{t("onboardingTasks")}</CardTitle>
                {isOwnerOrHr && <Link href="/hr/onboarding" className="text-xs text-brand-accent hover:underline">{t("manage")}</Link>}
              </div>
            </CardHeader>
            <CardContent>
              {onboardingTasks.length === 0 ? <EmptyState title={t("noOnboardingTasks")} icon={UserPlus} /> : (
                <div className="space-y-1.5">
                  {onboardingTasks.map((ot) => (
                    <div key={ot.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                      <div>
                        <p className="font-medium text-foreground">{ot.title}</p>
                        {ot.description && <p className="text-muted-foreground truncate max-w-[250px]">{ot.description}</p>}
                      </div>
                      <Badge variant={ot.status === "COMPLETED" ? "default" : ot.status === "CANCELLED" ? "outline" : "outline"} className={ot.status === "COMPLETED" ? "bg-brand-success text-white border-transparent" : ot.status === "IN_PROGRESS" ? "bg-amber-50 text-amber-600 border-amber-200" : ""}>{getStatusLabel(ot.status, locale)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Offboarding */}
        <TabsContent value="offboarding">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">{t("offboardingTasks")}</CardTitle>
                {isOwnerOrHr && <Link href="/hr/offboarding" className="text-xs text-brand-accent hover:underline">{t("manage")}</Link>}
              </div>
            </CardHeader>
            <CardContent>
              {offboardingTasks.length === 0 ? <EmptyState title={t("noOffboardingTasks")} icon={UserMinus} /> : (
                <div className="space-y-1.5">
                  {offboardingTasks.map((oft) => (
                    <div key={oft.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                      <div>
                        <p className="font-medium text-foreground">{oft.title}</p>
                        {oft.description && <p className="text-muted-foreground truncate max-w-[250px]">{oft.description}</p>}
                      </div>
                      <Badge variant={oft.status === "COMPLETED" ? "default" : "outline"} className={oft.status === "COMPLETED" ? "bg-brand-success text-white border-transparent" : oft.status === "IN_PROGRESS" ? "bg-amber-50 text-amber-600 border-amber-200" : ""}>{getStatusLabel(oft.status, locale)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit */}
        <TabsContent value="audit">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("auditLog")}</CardTitle></CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? <EmptyState title={t("noAuditEntries")} icon={ScrollText} /> : (
                <div className="max-h-96 space-y-1.5 overflow-y-auto battend-scroll">
                  {auditLogs.map((al) => (
                    <div key={al.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                      <div>
                         <p className="font-medium text-foreground">{displayAuditAction(al.action, locale)}</p>
                        <p className="text-muted-foreground">{al.actorEmail} · {formatDateTime(al.createdAt)}</p>
                      </div>
                      {al.reason && <span className="text-muted-foreground truncate max-w-[200px]">{al.reason}</span>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
