/**
 * GET /api/tenant/hr/employees/excel?branchId=...&departmentId=...&status=...&includeSensitive=true&includePayroll=true
 *
 * Returns an XLSX file with employee master data.
 * Sensitive columns (National ID, Salary) only included with explicit permissions.
 * Branch Manager never gets salary data.
 * Logs AuditLog + ReportExportLog BEFORE returning the response.
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

  // Feature gate check
  const featureCheck = await canUseHrFeature(tid, "hr_excel_export");
  if (!featureCheck.allowed) {
    const featureCheck2 = await canUseHrFeature(tid, "excel_export");
    if (!featureCheck2.allowed) {
      return NextResponse.json({ error: "Feature not available", reason: featureCheck2.reason ?? "Upgrade your plan to export HR data." }, { status: 403 });
    }
  }

  // Permission check
  if (!hasPerm(session.role, "EXPORT_HR_EXCEL")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  // Subscription active check
  const subscription = await db.subscription.findUnique({ where: { tenantId: tid } });
  if (!subscription || subscription.status !== "ACTIVE") {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
  }

  const tenant = await db.tenant.findUnique({ where: { id: tid }, select: { name: true } });

  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId");
  const departmentId = url.searchParams.get("departmentId");
  const status = url.searchParams.get("status") ?? "ACTIVE";
  const includeSensitiveParam = url.searchParams.get("includeSensitive") === "true";
  const includePayrollParam = url.searchParams.get("includePayroll") === "true";

  // Branch Manager scoping
  const isBranchManager = session.role === "BRANCH_MANAGER";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, tid) : [];
  if (isBranchManager && managedBranchIds.length === 0) {
    return NextResponse.json({ error: "No branches assigned" }, { status: 403 });
  }

  // Sensitive column permissions — Branch Manager NEVER gets salary
  const canViewSensitive = hasPerm(session.role, "VIEW_EMPLOYEE_SENSITIVE_DATA");
  const canViewPayroll = hasPerm(session.role, "VIEW_PAYROLL") || hasPerm(session.role, "MANAGE_PAYROLL");
  const includeNationalId = includeSensitiveParam && canViewSensitive;
  const includePayroll = includePayrollParam && canViewPayroll && !isBranchManager;

  // Build query
  const where: any = { companyId: tid, deletedAt: null };
  if (status && status !== "ALL") where.status = status;
  if (departmentId) where.departmentId = departmentId;
  if (branchId) {
    where.branchId = branchId;
  } else if (isBranchManager) {
    where.branchId = { in: managedBranchIds };
  }

  const employees = await db.employee.findMany({
    where,
    include: {
      branch: true,
      department: true,
      jobTitleRef: true,
      contracts: { where: { status: "ACTIVE" }, take: 1, orderBy: { startDate: "desc" } },
      documents: true,
      trainingAssignments: true,
      assetAssignments: { where: { status: "ASSIGNED" } },
      onboardingTasks: true,
      payrollProfile: includePayroll ? true : false,
    },
    orderBy: { employeeCode: "asc" },
    take: 5000,
  });

  // Build columns
  const columns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "fullName", label: "Full Name", width: 25 },
    { key: "arabicName", label: "Arabic Name", width: 20 },
    { key: "phone", label: "Phone", width: 15 },
    { key: "email", label: "Email", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "department", label: "Department", width: 15 },
    { key: "jobTitle", label: "Job Title", width: 20 },
    { key: "employmentType", label: "Employment Type", width: 15 },
    { key: "status", label: "Status", width: 12 },
    { key: "startDate", label: "Start Date", width: 12 },
    { key: "endDate", label: "End Date", width: 12 },
    { key: "contractType", label: "Contract Type", width: 15 },
    { key: "contractStatus", label: "Contract Status", width: 15 },
    { key: "documentStatus", label: "Document Status", width: 20 },
    { key: "trainingStatus", label: "Training Status", width: 20 },
    { key: "assetsCount", label: "Assets Count", width: 12 },
    { key: "onboardingStatus", label: "Onboarding Status", width: 15 },
  ];

  if (includeNationalId) {
    columns.splice(4, 0, { key: "nationalId", label: "National ID", width: 18 });
  }
  if (includePayroll) {
    columns.push({ key: "salary", label: "Salary", width: 15 });
  }

  // Build rows
  const rows: ExcelRow[] = employees.map((e) => {
    const latestContract = e.contracts?.[0];
    const docValid = e.documents.filter((d) => d.status === "VALID").length;
    const docTotal = e.documents.length;
    const trainingCompleted = e.trainingAssignments.filter((t) => t.status === "COMPLETED").length;
    const trainingTotal = e.trainingAssignments.length;
    const onboardingDone = e.onboardingTasks.filter((t) => t.status === "COMPLETED").length;
    const onboardingTotal = e.onboardingTasks.length;

    const row: ExcelRow = {
      employeeCode: e.employeeCode,
      fullName: e.fullName,
      arabicName: e.arabicName ?? "",
      phone: e.phone ?? "",
      email: e.email ?? "",
      branch: e.branch?.name ?? "",
      department: e.department?.name ?? "",
      jobTitle: e.jobTitleRef?.title ?? e.jobTitle ?? "",
      employmentType: e.employmentType.replace(/_/g, " "),
      status: e.status,
      startDate: e.startDate ? new Date(e.startDate).toLocaleDateString() : "",
      endDate: e.endDate ? new Date(e.endDate).toLocaleDateString() : "",
      contractType: latestContract?.contractType?.replace(/_/g, " ") ?? "",
      contractStatus: latestContract?.status ?? "",
      documentStatus: docTotal > 0 ? `${docValid}/${docTotal} valid` : "None",
      trainingStatus: trainingTotal > 0 ? `${trainingCompleted}/${trainingTotal} completed` : "None",
      assetsCount: e.assetAssignments.length,
      onboardingStatus: onboardingTotal > 0 ? `${onboardingDone}/${onboardingTotal} done` : "None",
    };

    if (includeNationalId) {
      row.nationalId = e.nationalId ?? "";
    }
    if (includePayroll) {
      row.salary = e.payrollProfile?.baseSalary ?? "";
    }

    return row;
  });

  // 1. Generate workbook
  const wb = createWorkbook();
  addReportHeaderSheet(wb, {
    companyName: tenant?.name ?? "Company",
    reportTitle: "Employee Master Report",
    generatedBy: session.email,
    generatedAt: new Date(),
    filters: { branchId: branchId ?? "All", departmentId: departmentId ?? "All", status, includeSensitive: String(includeNationalId), includePayroll: String(includePayroll) },
  });
  addWorksheetFromRows(wb, "Employees", columns, rows.length > 0 ? rows : NO_RECORDS);

  // 2. Calculate filename and row count
  const filename = excelFilename("employee-master");
  const rowCount = rows.length;

  // 3. Create AuditLog BEFORE returning response
  await logTenantEvent({
    companyId: tid,
    actorId: session.sub,
    actorEmail: session.email,
    action: "HR_EXCEL_EXPORTED",
    entityType: "Report",
    entityId: "employee-master",
    reason: `${rowCount} employees exported${branchId ? ` branch=${branchId}` : ""}${includeNationalId ? " +nationalId" : ""}${includePayroll ? " +salary" : ""}`,
  });

  // 4. Create ReportExportLog BEFORE returning response
  await db.reportExportLog.create({
    data: {
      companyId: tid,
      reportType: "employee-master",
      filters: JSON.stringify({ branchId, departmentId, status, includeSensitive: includeNationalId, includePayroll }),
      rowCount,
      fileName: filename,
      exportedById: session.sub,
      exportedByEmail: session.email,
    },
  });

  // 5. Return workbook response (last)
  return sendWorkbookResponse(wb, filename);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
