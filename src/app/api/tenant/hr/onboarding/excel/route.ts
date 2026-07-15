import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logTenantEvent } from "@/lib/auth/audit";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { getRolePermissions, getManagedBranchIds, type HrPermission } from "@/lib/hr/permissions";
import {
  createWorkbook, addReportHeaderSheet, addWorksheetFromRows,
  sendWorkbookResponse, excelFilename,
  type ExcelColumn, type ExcelRow,
} from "@/lib/excel/exporter";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

const NO_RECORDS: ExcelRow[] = [{ msg: "No records found." }];
const EMPTY_COL: ExcelColumn[] = [{ key: "msg", label: "Info", width: 40 }];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tid = session.tenantId;

  const featureCheck = await canUseHrFeature(tid, "hr_excel_export");
  if (!featureCheck.allowed) {
    const featureCheck2 = await canUseHrFeature(tid, "excel_export");
    if (!featureCheck2.allowed) {
      return NextResponse.json({ error: "Feature not available", reason: featureCheck2.reason ?? "Upgrade your plan." }, { status: 403 });
    }
  }

  if (!hasPerm(session.role, "EXPORT_HR_EXCEL")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  const subscription = await db.subscription.findUnique({ where: { tenantId: tid } });
  if (!subscription || subscription.status !== "ACTIVE") {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
  }

  const tenant = await db.tenant.findUnique({ where: { id: tid }, select: { name: true } });

  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId");
  const employeeId = url.searchParams.get("employeeId");

  const isBranchManager = session.role === "BRANCH_MANAGER";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, tid) : [];
  if (isBranchManager && managedBranchIds.length === 0) {
    return NextResponse.json({ error: "No branches assigned" }, { status: 403 });
  }

  const employeeWhere: any = { companyId: tid };
  if (branchId) {
    employeeWhere.branchId = branchId;
  } else if (isBranchManager) {
    employeeWhere.branchId = { in: managedBranchIds };
  }
  if (employeeId) {
    employeeWhere.id = employeeId;
  }

  const matchingEmployeeIds = (await db.employee.findMany({ where: employeeWhere, select: { id: true } })).map((e) => e.id);

  const tasks = await db.onboardingTask.findMany({
    where: { companyId: tid, employeeId: { in: matchingEmployeeIds } },
    include: {
      employee: { select: { employeeCode: true, fullName: true, branch: { select: { name: true } }, department: { select: { name: true } }, onboardingStatus: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const employeeProgressMap = new Map<string, { total: number; completed: number; inProgress: number; pending: number }>();
  for (const t of tasks) {
    const empId = t.employeeId;
    if (!employeeProgressMap.has(empId)) {
      employeeProgressMap.set(empId, { total: 0, completed: 0, inProgress: 0, pending: 0 });
    }
    const p = employeeProgressMap.get(empId)!;
    p.total++;
    if (t.status === "COMPLETED") p.completed++;
    else if (t.status === "IN_PROGRESS") p.inProgress++;
    else if (t.status === "PENDING") p.pending++;
  }

  const employeesWithOnboarding = await db.employee.findMany({
    where: { companyId: tid, id: { in: matchingEmployeeIds }, onboardingStatus: { not: "NONE" } },
    select: { id: true, employeeCode: true, fullName: true, branch: { select: { name: true } }, department: { select: { name: true } }, onboardingStatus: true },
  });

  const progressColumns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "department", label: "Department", width: 15 },
    { key: "onboardingStatus", label: "Status", width: 16 },
    { key: "totalTasks", label: "Total Tasks", width: 12 },
    { key: "completedTasks", label: "Completed", width: 12 },
    { key: "inProgressTasks", label: "In Progress", width: 12 },
    { key: "pendingTasks", label: "Pending", width: 12 },
    { key: "completionPercent", label: "Completion %", width: 14 },
  ];
  const progressRows: ExcelRow[] = employeesWithOnboarding.map((e) => {
    const p = employeeProgressMap.get(e.id) ?? { total: 0, completed: 0, inProgress: 0, pending: 0 };
    const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
    return {
      employeeCode: e.employeeCode,
      employeeName: e.fullName,
      branch: e.branch?.name ?? "",
      department: e.department?.name ?? "",
      onboardingStatus: e.onboardingStatus,
      totalTasks: p.total,
      completedTasks: p.completed,
      inProgressTasks: p.inProgress,
      pendingTasks: p.pending,
      completionPercent: `${pct}%`,
    };
  });

  const pendingTasks = tasks.filter((t) => t.status === "PENDING");
  const pendingColumns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "title", label: "Task", width: 30 },
    { key: "description", label: "Description", width: 30 },
    { key: "dueDate", label: "Due Date", width: 12 },
    { key: "status", label: "Status", width: 14 },
  ];
  const pendingRows: ExcelRow[] = pendingTasks.map((t) => ({
    employeeCode: t.employee.employeeCode,
    employeeName: t.employee.fullName,
    branch: t.employee.branch?.name ?? "",
    title: t.title,
    description: t.description ?? "",
    dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "",
    status: t.status,
  }));

  const overdueTasks = tasks.filter((t) => t.status === "PENDING" && t.dueDate && new Date(t.dueDate) < new Date());
  const overdueColumns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "title", label: "Task", width: 30 },
    { key: "dueDate", label: "Due Date", width: 12 },
    { key: "daysOverdue", label: "Days Overdue", width: 14 },
  ];
  const overdueRows: ExcelRow[] = overdueTasks.map((t) => {
    const dueMs = new Date(t.dueDate!).getTime();
    const daysOverdue = Math.max(0, Math.floor((Date.now() - dueMs) / (1000 * 60 * 60 * 24)));
    return {
      employeeCode: t.employee.employeeCode,
      employeeName: t.employee.fullName,
      branch: t.employee.branch?.name ?? "",
      title: t.title,
      dueDate: new Date(t.dueDate!).toLocaleDateString(),
      daysOverdue,
    };
  });

  const wb = createWorkbook();
  addReportHeaderSheet(wb, {
    companyName: tenant?.name ?? "Company",
    reportTitle: "Onboarding Report",
    generatedBy: session.email,
    generatedAt: new Date(),
    filters: { branchId: branchId ?? "All", employeeId: employeeId ?? "All" },
  });
  addWorksheetFromRows(wb, "Employee Progress", progressColumns, progressRows.length > 0 ? progressRows : NO_RECORDS);
  addWorksheetFromRows(wb, "Pending Tasks", pendingColumns, pendingRows.length > 0 ? pendingRows : NO_RECORDS);
  addWorksheetFromRows(wb, "Overdue Tasks", overdueColumns, overdueRows.length > 0 ? overdueRows : NO_RECORDS);

  const filename = excelFilename("onboarding-report");

  await logTenantEvent({
    companyId: tid, actorId: session.sub, actorEmail: session.email,
    action: "HR_EXCEL_EXPORTED", entityType: "Report", entityId: "onboarding-report",
    reason: "Onboarding report exported",
  });

  await db.reportExportLog.create({
    data: { companyId: tid, reportType: "onboarding-report", filters: JSON.stringify({ branchId, employeeId }), rowCount: tasks.length, fileName: filename, exportedById: session.sub, exportedByEmail: session.email },
  });

  return sendWorkbookResponse(wb, filename);
}
