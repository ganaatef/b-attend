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
  const branchId = url.searchParams.get("branchId");
  const employeeId = url.searchParams.get("employeeId");

  const isBranchManager = session.role === "BRANCH_MANAGER";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, tid) : [];
  if (isBranchManager && managedBranchIds.length === 0) {
    return NextResponse.json({ error: "No branches assigned" }, { status: 403 });
  }

  const assets = await db.asset.findMany({
    where: { companyId: tid },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const assignmentWhere: any = { companyId: tid };
  if (branchId || isBranchManager || employeeId) {
    assignmentWhere.employee = {};
    if (branchId) {
      assignmentWhere.employee.branchId = branchId;
    } else if (isBranchManager) {
      assignmentWhere.employee.branchId = { in: managedBranchIds };
    }
    if (employeeId) {
      assignmentWhere.employeeId = employeeId;
    }
  }

  const assignments = await db.assetAssignment.findMany({
    where: assignmentWhere,
    include: {
      asset: { select: { name: true, type: true, code: true } },
      employee: { select: { employeeCode: true, fullName: true, branch: { select: { name: true } }, department: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const assetCatalogColumns: ExcelColumn[] = [
    { key: "name", label: "Asset Name", width: 25 },
    { key: "type", label: "Type", width: 15 },
    { key: "code", label: "Code", width: 15 },
    { key: "status", label: "Status", width: 14 },
    { key: "purchaseDate", label: "Purchase Date", width: 14 },
    { key: "notes", label: "Notes", width: 25 },
    { key: "assignmentsCount", label: "Assignments", width: 14 },
  ];
  const assetCatalogRows: ExcelRow[] = assets.map((a) => ({
    name: a.name,
    type: a.type.replace(/_/g, " "),
    code: a.code ?? "",
    status: a.status,
    purchaseDate: a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString() : "",
    notes: a.notes ?? "",
    assignmentsCount: assignments.filter((asgn) => asgn.assetId === a.id).length,
  }));

  const activeAssignments = assignments.filter((a) => a.status === "ASSIGNED");
  const activeColumns: ExcelColumn[] = [
    { key: "assetName", label: "Asset Name", width: 25 },
    { key: "assetType", label: "Asset Type", width: 15 },
    { key: "assetCode", label: "Asset Code", width: 15 },
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "department", label: "Department", width: 15 },
    { key: "assignedAt", label: "Assigned", width: 12 },
    { key: "conditionOnAssign", label: "Condition On Assign", width: 20 },
    { key: "notes", label: "Notes", width: 25 },
  ];
  const activeRows: ExcelRow[] = activeAssignments.map((a) => ({
    assetName: a.asset.name,
    assetType: a.asset.type.replace(/_/g, " "),
    assetCode: a.asset.code ?? "",
    employeeCode: a.employee.employeeCode,
    employeeName: a.employee.fullName,
    branch: a.employee.branch?.name ?? "",
    department: a.employee.department?.name ?? "",
    assignedAt: new Date(a.assignedAt).toLocaleDateString(),
    conditionOnAssign: a.conditionOnAssign ?? "",
    notes: a.notes ?? "",
  }));

  const returnedAssignments = assignments.filter((a) => a.status === "RETURNED" || (a.status === "ASSIGNED" && a.returnedAt));
  const returnedColumns: ExcelColumn[] = [
    { key: "assetName", label: "Asset Name", width: 25 },
    { key: "assetCode", label: "Asset Code", width: 15 },
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "assignedAt", label: "Assigned", width: 12 },
    { key: "returnedAt", label: "Returned", width: 12 },
    { key: "conditionOnReturn", label: "Condition On Return", width: 20 },
  ];
  const returnedRows: ExcelRow[] = returnedAssignments.map((a) => ({
    assetName: a.asset.name,
    assetCode: a.asset.code ?? "",
    employeeCode: a.employee.employeeCode,
    employeeName: a.employee.fullName,
    branch: a.employee.branch?.name ?? "",
    assignedAt: new Date(a.assignedAt).toLocaleDateString(),
    returnedAt: a.returnedAt ? new Date(a.returnedAt).toLocaleDateString() : "",
    conditionOnReturn: a.conditionOnReturn ?? "",
  }));

  const lostDamagedAssignments = assignments.filter((a) => a.status === "LOST" || a.status === "DAMAGED");
  const lostDamagedColumns: ExcelColumn[] = [
    { key: "assetName", label: "Asset Name", width: 25 },
    { key: "assetType", label: "Asset Type", width: 15 },
    { key: "assetCode", label: "Asset Code", width: 15 },
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "assignedAt", label: "Assigned", width: 12 },
    { key: "status", label: "Status", width: 14 },
    { key: "notes", label: "Notes", width: 25 },
  ];
  const lostDamagedRows: ExcelRow[] = lostDamagedAssignments.map((a) => ({
    assetName: a.asset.name,
    assetType: a.asset.type.replace(/_/g, " "),
    assetCode: a.asset.code ?? "",
    employeeCode: a.employee.employeeCode,
    employeeName: a.employee.fullName,
    branch: a.employee.branch?.name ?? "",
    assignedAt: new Date(a.assignedAt).toLocaleDateString(),
    status: a.status,
    notes: a.notes ?? "",
  }));

  const wb = createWorkbook();
  addReportHeaderSheet(wb, {
    companyName: tenant?.name ?? "Company",
    reportTitle: "Assets Report",
    generatedBy: session.email,
    generatedAt: new Date(),
    filters: { branchId: branchId ?? "All", employeeId: employeeId ?? "All" },
  });
  addWorksheetFromRows(wb, "Asset Catalog", assetCatalogColumns, assetCatalogRows.length > 0 ? assetCatalogRows : NO_RECORDS);
  addWorksheetFromRows(wb, "Active Assignments", activeColumns, activeRows.length > 0 ? activeRows : NO_RECORDS);
  addWorksheetFromRows(wb, "Returned Assets", returnedColumns, returnedRows.length > 0 ? returnedRows : NO_RECORDS);
  addWorksheetFromRows(wb, "Lost/Damaged", lostDamagedColumns, lostDamagedRows.length > 0 ? lostDamagedRows : NO_RECORDS);

  const filename = excelFilename("assets-report");

  await logTenantEvent({
    companyId: tid, actorId: session.sub, actorEmail: session.email,
    action: "HR_EXCEL_EXPORTED", entityType: "Report", entityId: "assets-report",
    reason: "Assets report exported",
  });

  await db.reportExportLog.create({
    data: { companyId: tid, reportType: "assets-report", filters: JSON.stringify({ branchId, employeeId }), rowCount: assets.length + assignments.length, fileName: filename, exportedById: session.sub, exportedByEmail: session.email },
  });

  return sendWorkbookResponse(wb, filename);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
