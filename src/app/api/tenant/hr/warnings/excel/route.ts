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

  const canViewSensitive = hasPerm(session.role, "VIEW_EMPLOYEE_SENSITIVE_DATA") && !isBranchManager;

  const where: any = { companyId: tid };
  if (branchId) {
    where.branchId = branchId;
  } else if (isBranchManager) {
    where.branchId = { in: managedBranchIds };
  }
  if (employeeId) {
    where.employeeId = employeeId;
  }

  const warnings = await db.employeeWarning.findMany({
    where,
    include: {
      employee: { select: { employeeCode: true, fullName: true, branch: { select: { id: true, name: true } }, department: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const warningColumns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "department", label: "Department", width: 15 },
    { key: "type", label: "Type", width: 18 },
    { key: "severity", label: "Severity", width: 12 },
    { key: "date", label: "Date", width: 12 },
    { key: "reason", label: "Reason", width: 30 },
    { key: "actionTaken", label: "Action Taken", width: 25 },
    { key: "status", label: "Status", width: 12 },
    { key: "acknowledged", label: "Acknowledged", width: 14 },
    { key: "notes", label: "Notes", width: 25 },
  ];

  const warningRows: ExcelRow[] = warnings.map((w) => ({
    employeeCode: w.employee.employeeCode,
    employeeName: w.employee.fullName,
    branch: w.employee.branch?.name ?? "",
    department: w.employee.department?.name ?? "",
    type: w.type.replace(/_/g, " "),
    severity: w.severity,
    date: new Date(w.date).toLocaleDateString(),
    reason: w.reason,
    actionTaken: w.actionTaken ?? "",
    status: w.status,
    acknowledged: w.acknowledgedByEmployee ? "Yes" : "No",
    notes: canViewSensitive ? (w.notes ?? "") : "████████",
  }));

  const severityCounts: Record<string, number> = {};
  for (const w of warnings) {
    severityCounts[w.severity] = (severityCounts[w.severity] ?? 0) + 1;
  }
  const severityColumns: ExcelColumn[] = [
    { key: "severity", label: "Severity", width: 15 },
    { key: "count", label: "Count", width: 10 },
  ];
  const severityRows: ExcelRow[] = Object.entries(severityCounts).map(([severity, count]) => ({
    severity,
    count,
  }));

  const openWarnings = warnings.filter((w) => w.status === "OPEN");
  const openColumns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "type", label: "Type", width: 18 },
    { key: "severity", label: "Severity", width: 12 },
    { key: "date", label: "Date", width: 12 },
    { key: "reason", label: "Reason", width: 30 },
  ];
  const openRows: ExcelRow[] = openWarnings.map((w) => ({
    employeeCode: w.employee.employeeCode,
    employeeName: w.employee.fullName,
    branch: w.employee.branch?.name ?? "",
    type: w.type.replace(/_/g, " "),
    severity: w.severity,
    date: new Date(w.date).toLocaleDateString(),
    reason: w.reason,
  }));

  const wb = createWorkbook();
  addReportHeaderSheet(wb, {
    companyName: tenant?.name ?? "Company",
    reportTitle: "Employee Warnings Report",
    generatedBy: session.email,
    generatedAt: new Date(),
    filters: { branchId: branchId ?? "All", employeeId: employeeId ?? "All" },
  });
  addWorksheetFromRows(wb, "Warnings", warningColumns, warningRows.length > 0 ? warningRows : NO_RECORDS);
  addWorksheetFromRows(wb, "By Severity", severityColumns, severityRows.length > 0 ? severityRows : NO_RECORDS);
  addWorksheetFromRows(wb, "Open Warnings", openColumns, openRows.length > 0 ? openRows : NO_RECORDS);

  const filename = excelFilename("employee-warnings");

  await logTenantEvent({
    companyId: tid, actorId: session.sub, actorEmail: session.email,
    action: "HR_EXCEL_EXPORTED", entityType: "Report", entityId: "employee-warnings",
    reason: "Warnings report exported",
  });

  await db.reportExportLog.create({
    data: { companyId: tid, reportType: "employee-warnings", filters: JSON.stringify({ branchId, employeeId }), rowCount: warnings.length, fileName: filename, exportedById: session.sub, exportedByEmail: session.email },
  });

  return sendWorkbookResponse(wb, filename);
}
