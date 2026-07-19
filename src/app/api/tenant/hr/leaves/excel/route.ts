/**
 * GET /api/tenant/hr/leaves/excel?status=...&leaveTypeId=...
 * Returns XLSX with all leave requests.
 */
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
  try {
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
  const status = url.searchParams.get("status");
  const leaveTypeId = url.searchParams.get("leaveTypeId");

  const isBranchManager = session.role === "BRANCH_MANAGER";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, tid) : [];

  const where: any = { companyId: tid };
  if (status && status !== "ALL") where.status = status;
  if (leaveTypeId) where.leaveTypeId = leaveTypeId;
  if (isBranchManager && managedBranchIds.length > 0) {
    where.employee = { branchId: { in: managedBranchIds } };
  }

  const leaveRequests = await db.leaveRequest.findMany({
    where,
    include: {
      employee: { select: { employeeCode: true, fullName: true, branch: { select: { name: true } }, department: { select: { name: true } } } },
      leaveType: { select: { name: true, code: true, paid: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const columns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "department", label: "Department", width: 15 },
    { key: "leaveType", label: "Leave Type", width: 18 },
    { key: "leaveCode", label: "Code", width: 10 },
    { key: "paid", label: "Paid", width: 8 },
    { key: "startDate", label: "Start Date", width: 12 },
    { key: "endDate", label: "End Date", width: 12 },
    { key: "daysCount", label: "Days", width: 8 },
    { key: "status", label: "Status", width: 12 },
    { key: "reason", label: "Reason", width: 25 },
    { key: "managerNotes", label: "Manager Notes", width: 25 },
  ];

  const rows: ExcelRow[] = leaveRequests.map((lr) => ({
    employeeCode: lr.employee.employeeCode,
    employeeName: lr.employee.fullName,
    branch: lr.employee.branch?.name ?? "",
    department: lr.employee.department?.name ?? "",
    leaveType: lr.leaveType.name,
    leaveCode: lr.leaveType.code,
    paid: lr.leaveType.paid ? "Yes" : "No",
    startDate: new Date(lr.startDate).toLocaleDateString(),
    endDate: new Date(lr.endDate).toLocaleDateString(),
    daysCount: lr.daysCount,
    status: lr.status,
    reason: lr.reason ?? "",
    managerNotes: lr.managerNotes ?? "",
  }));

  const wb = createWorkbook();
  addReportHeaderSheet(wb, {
    companyName: tenant?.name ?? "Company",
    reportTitle: "Leave Requests Report",
    generatedBy: session.email,
    generatedAt: new Date(),
    filters: { status: status ?? "All", leaveType: leaveTypeId ?? "All" },
  });
  addWorksheetFromRows(wb, "Leave Requests", columns, rows.length > 0 ? rows : NO_RECORDS);

  const filename = excelFilename("leave-requests");

  await logTenantEvent({
    companyId: tid, actorId: session.sub, actorEmail: session.email,
    action: "HR_EXCEL_EXPORTED", entityType: "Report", entityId: "leave-requests",
    reason: `${leaveRequests.length} leave requests exported`,
  });

  await db.reportExportLog.create({
    data: { companyId: tid, reportType: "leave-requests", filters: JSON.stringify({ status, leaveTypeId }), rowCount: leaveRequests.length, fileName: filename, exportedById: session.sub, exportedByEmail: session.email },
  });

  return sendWorkbookResponse(wb, filename);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
