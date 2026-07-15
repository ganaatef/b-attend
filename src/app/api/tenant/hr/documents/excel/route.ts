/**
 * GET /api/tenant/hr/documents/excel
 * Returns XLSX with all employee documents.
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

  const SENSITIVE_DOC_TYPES = ["NATIONAL_ID", "PASSPORT", "WORK_PERMIT", "MEDICAL_CERTIFICATE", "INSURANCE_FORM"];

  const url = new URL(req.url);
  const includeSensitiveParam = url.searchParams.get("includeSensitive") === "true";

  const isBranchManager = session.role === "BRANCH_MANAGER";
  const canViewSensitive = hasPerm(session.role, "VIEW_EMPLOYEE_SENSITIVE_DATA") && !isBranchManager;
  const includeSensitive = includeSensitiveParam && canViewSensitive;

  const documents = await db.employeeDocument.findMany({
    where: { companyId: tid },
    include: {
      employee: { select: { employeeCode: true, fullName: true, branch: { select: { name: true } }, department: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const columns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "department", label: "Department", width: 15 },
    { key: "documentType", label: "Document Type", width: 22 },
    { key: "status", label: "Status", width: 15 },
    { key: "issueDate", label: "Issue Date", width: 12 },
    { key: "expiryDate", label: "Expiry Date", width: 12 },
  ];

  if (includeSensitive) {
    columns.splice(5, 0, { key: "documentNumber", label: "Document #", width: 18 });
    columns.push({ key: "notes", label: "Notes", width: 25 });
  }

  const rows: ExcelRow[] = documents.map((d) => {
    const isSensitive = SENSITIVE_DOC_TYPES.includes(d.documentType);
    const row: ExcelRow = {
      employeeCode: d.employee.employeeCode,
      employeeName: d.employee.fullName,
      branch: d.employee.branch?.name ?? "",
      department: d.employee.department?.name ?? "",
      documentType: d.documentType.replace(/_/g, " "),
      status: d.status.replace(/_/g, " "),
      issueDate: d.issueDate ? new Date(d.issueDate).toLocaleDateString() : "",
      expiryDate: d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : "",
    };
    if (includeSensitive) {
      row.documentNumber = d.documentNumber ?? "";
      row.notes = d.notes ?? "";
    } else if (isSensitive) {
      row.documentNumber = "████████";
    } else {
      row.documentNumber = d.documentNumber ?? "";
    }
    return row;
  });

  const wb = createWorkbook();
  addReportHeaderSheet(wb, {
    companyName: tenant?.name ?? "Company",
    reportTitle: "Employee Documents Report",
    generatedBy: session.email,
    generatedAt: new Date(),
  });
  addWorksheetFromRows(wb, "Documents", columns, rows.length > 0 ? rows : NO_RECORDS);

  const filename = excelFilename("employee-documents");

  await logTenantEvent({
    companyId: tid, actorId: session.sub, actorEmail: session.email,
    action: "HR_EXCEL_EXPORTED", entityType: "Report", entityId: "employee-documents",
    reason: `${documents.length} documents exported${includeSensitive ? " +sensitive" : ""}`,
  });

  await db.reportExportLog.create({
    data: { companyId: tid, reportType: "employee-documents", rowCount: documents.length, fileName: filename, exportedById: session.sub, exportedByEmail: session.email, filters: JSON.stringify({ includeSensitive }) },
  });

  return sendWorkbookResponse(wb, filename);
}
