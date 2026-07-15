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

  const employeeWhere: any = { companyId: tid, offboardingStatus: { not: "NONE" } };
  if (branchId) {
    employeeWhere.branchId = branchId;
  } else if (isBranchManager) {
    employeeWhere.branchId = { in: managedBranchIds };
  }
  if (employeeId) {
    employeeWhere.id = employeeId;
  }

  const offboardingEmployees = await db.employee.findMany({
    where: employeeWhere,
    select: { id: true, employeeCode: true, fullName: true, branch: { select: { name: true } }, department: { select: { name: true } }, offboardingStatus: true, endDate: true },
    orderBy: { updatedAt: "desc" },
  });

  const matchingEmployeeIds = offboardingEmployees.map((e) => e.id);

  const tasks = await db.offboardingTask.findMany({
    where: { companyId: tid, employeeId: { in: matchingEmployeeIds } },
    include: {
      employee: { select: { employeeCode: true, fullName: true, branch: { select: { name: true } }, department: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const employeesInOffboardingColumns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "department", label: "Department", width: 15 },
    { key: "offboardingStatus", label: "Offboarding Status", width: 18 },
    { key: "endDate", label: "End Date", width: 12 },
    { key: "totalTasks", label: "Total Tasks", width: 12 },
    { key: "completedTasks", label: "Completed", width: 12 },
    { key: "pendingTasks", label: "Pending", width: 12 },
  ];
  const employeesInOffboardingRows: ExcelRow[] = offboardingEmployees.map((e) => {
    const empTasks = tasks.filter((t) => t.employeeId === e.id);
    const completedCount = empTasks.filter((t) => t.status === "COMPLETED").length;
    const pendingCount = empTasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS").length;
    return {
      employeeCode: e.employeeCode,
      employeeName: e.fullName,
      branch: e.branch?.name ?? "",
      department: e.department?.name ?? "",
      offboardingStatus: e.offboardingStatus,
      endDate: e.endDate ? new Date(e.endDate).toLocaleDateString() : "",
      totalTasks: empTasks.length,
      completedTasks: completedCount,
      pendingTasks: pendingCount,
    };
  });

  const pendingTasks = tasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS");
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

  const completedTasks = tasks.filter((t) => t.status === "COMPLETED");
  const completedColumns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "title", label: "Task", width: 30 },
    { key: "completedAt", label: "Completed At", width: 14 },
  ];
  const completedRows: ExcelRow[] = completedTasks.map((t) => ({
    employeeCode: t.employee.employeeCode,
    employeeName: t.employee.fullName,
    branch: t.employee.branch?.name ?? "",
    title: t.title,
    completedAt: t.completedAt ? new Date(t.completedAt).toLocaleDateString() : "",
  }));

  const finalizationColumns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "offboardingStatus", label: "Status", width: 18 },
    { key: "totalTasks", label: "Total Tasks", width: 12 },
    { key: "completedTasks", label: "Completed", width: 12 },
    { key: "pendingTasks", label: "Pending", width: 12 },
    { key: "completionPercent", label: "Completion %", width: 14 },
    { key: "finalized", label: "Finalized", width: 12 },
  ];
  const finalizationRows: ExcelRow[] = offboardingEmployees.map((e) => {
    const empTasks = tasks.filter((t) => t.employeeId === e.id);
    const completedCount = empTasks.filter((t) => t.status === "COMPLETED").length;
    const pendingCount = empTasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS").length;
    const total = empTasks.length;
    const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    const isFinalized = e.offboardingStatus === "COMPLETED" || (total > 0 && completedCount === total);
    return {
      employeeCode: e.employeeCode,
      employeeName: e.fullName,
      branch: e.branch?.name ?? "",
      offboardingStatus: e.offboardingStatus,
      totalTasks: total,
      completedTasks: completedCount,
      pendingTasks: pendingCount,
      completionPercent: `${pct}%`,
      finalized: isFinalized ? "Yes" : "No",
    };
  });

  const wb = createWorkbook();
  addReportHeaderSheet(wb, {
    companyName: tenant?.name ?? "Company",
    reportTitle: "Offboarding Report",
    generatedBy: session.email,
    generatedAt: new Date(),
    filters: { branchId: branchId ?? "All", employeeId: employeeId ?? "All" },
  });
  addWorksheetFromRows(wb, "Employees In Offboarding", employeesInOffboardingColumns, employeesInOffboardingRows.length > 0 ? employeesInOffboardingRows : NO_RECORDS);
  addWorksheetFromRows(wb, "Pending Tasks", pendingColumns, pendingRows.length > 0 ? pendingRows : NO_RECORDS);
  addWorksheetFromRows(wb, "Completed Tasks", completedColumns, completedRows.length > 0 ? completedRows : NO_RECORDS);
  addWorksheetFromRows(wb, "Finalization Status", finalizationColumns, finalizationRows.length > 0 ? finalizationRows : NO_RECORDS);

  const filename = excelFilename("offboarding-report");

  await logTenantEvent({
    companyId: tid, actorId: session.sub, actorEmail: session.email,
    action: "HR_EXCEL_EXPORTED", entityType: "Report", entityId: "offboarding-report",
    reason: "Offboarding report exported",
  });

  await db.reportExportLog.create({
    data: { companyId: tid, reportType: "offboarding-report", filters: JSON.stringify({ branchId, employeeId }), rowCount: tasks.length, fileName: filename, exportedById: session.sub, exportedByEmail: session.email },
  });

  return sendWorkbookResponse(wb, filename);
}
