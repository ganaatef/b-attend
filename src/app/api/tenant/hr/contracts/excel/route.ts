/**
 * GET /api/tenant/hr/contracts/excel
 * Returns XLSX with all employee contracts.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logTenantEvent } from "@/lib/auth/audit";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
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
  const includePayrollParam = url.searchParams.get("includePayroll") === "true";

  const isBranchManager = session.role === "BRANCH_MANAGER";
  const canViewPayroll = (hasPerm(session.role, "VIEW_PAYROLL") || hasPerm(session.role, "MANAGE_PAYROLL")) && !isBranchManager;
  const includePayroll = includePayrollParam && canViewPayroll;

  const contracts = await db.employeeContract.findMany({
    where: { companyId: tid },
    include: {
      employee: { select: { employeeCode: true, fullName: true, branch: { select: { name: true } }, department: { select: { name: true } } } },
    },
    orderBy: { startDate: "desc" },
    take: 5000,
  });

  const columns: ExcelColumn[] = [
    { key: "contractNumber", label: "Contract #", width: 18 },
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "department", label: "Department", width: 15 },
    { key: "contractType", label: "Type", width: 15 },
    { key: "status", label: "Status", width: 12 },
    { key: "startDate", label: "Start Date", width: 12 },
    { key: "endDate", label: "End Date", width: 12 },
    { key: "probationEnd", label: "Probation End", width: 15 },
    { key: "notes", label: "Notes", width: 25 },
  ];

  if (includePayroll) {
    columns.splice(10, 0, { key: "salaryRef", label: "Salary Ref", width: 12 });
  }

  const rows: ExcelRow[] = contracts.map((c) => {
    const row: ExcelRow = {
      contractNumber: c.contractNumber,
      employeeCode: c.employee.employeeCode,
      employeeName: c.employee.fullName,
      branch: c.employee.branch?.name ?? "",
      department: c.employee.department?.name ?? "",
      contractType: c.contractType.replace(/_/g, " "),
      status: c.status,
      startDate: new Date(c.startDate).toLocaleDateString(),
      endDate: c.endDate ? new Date(c.endDate).toLocaleDateString() : "Open",
      probationEnd: c.probationEndDate ? new Date(c.probationEndDate).toLocaleDateString() : "",
      notes: c.notes ?? "",
    };
    if (includePayroll) {
      row.salaryRef = c.salaryReference ?? "";
    }
    return row;
  });

  const wb = createWorkbook();
  addReportHeaderSheet(wb, {
    companyName: tenant?.name ?? "Company",
    reportTitle: "Employee Contracts Report",
    generatedBy: session.email,
    generatedAt: new Date(),
  });
  addWorksheetFromRows(wb, "Contracts", columns, rows.length > 0 ? rows : NO_RECORDS);

  const filename = excelFilename("employee-contracts");

  await logTenantEvent({
    companyId: tid, actorId: session.sub, actorEmail: session.email,
    action: "HR_EXCEL_EXPORTED", entityType: "Report", entityId: "employee-contracts",
    reason: `${contracts.length} contracts exported${includePayroll ? " +salaryRef" : ""}`,
  });

  await db.reportExportLog.create({
    data: { companyId: tid, reportType: "employee-contracts", rowCount: contracts.length, fileName: filename, exportedById: session.sub, exportedByEmail: session.email, filters: JSON.stringify({ includePayroll }) },
  });

  return sendWorkbookResponse(wb, filename);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
