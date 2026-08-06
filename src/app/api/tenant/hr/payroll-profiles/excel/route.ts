import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  createWorkbook,
  addReportHeaderSheet,
  addWorksheetFromRows,
  sendWorkbookResponse,
  excelFilename,
  type ExcelColumn, type ExcelRow,
} from "@/lib/excel/exporter";
import { getRolePermissions } from "@/lib/hr/permissions";
import { logTenantEvent } from "@/lib/auth/audit";
import { canUseHrFeature } from "@/lib/hr/feature-gates";

const NO_RECORDS: ExcelRow[] = [{ msg: "No records found." }];
const EMPTY_COL: ExcelColumn[] = [{ key: "msg", label: "Info", width: 40 }];

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.kind !== "tenant" || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role === "EMPLOYEE" || session.role === "BRANCH_MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

  const tid = session.tenantId;
  const permissions = getRolePermissions(session.role);
  if (!permissions.includes("EXPORT_HR_EXCEL")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const featureGate = await canUseHrFeature(tid, "hr_excel_export");
  if (!featureGate.allowed) {
    const featureGate2 = await canUseHrFeature(tid, "excel_export");
    if (!featureGate2.allowed) {
      return NextResponse.json({ error: featureGate2.reason ?? "Feature not available" }, { status: 403 });
    }
  }

  const subscription = await db.subscription.findUnique({ where: { tenantId: tid } });
  if (!subscription || subscription.status !== "ACTIVE") {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
  }

  const profiles = await db.payrollProfile.findMany({
    where: { companyId: tid },
    include: {
      employee: {
        include: {
          branch: { select: { name: true } },
          department: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const tenant = await db.tenant.findUnique({ where: { id: tid }, select: { name: true } });
  const activeCount = profiles.filter((p) => p.active).length;

  const canViewSalary = ["HR_ADMIN", "HR_MANAGER", "SUPER_ADMIN"].includes(session.role);

  const columns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 18 },
    { key: "name", label: "Name", width: 25 },
    { key: "branch", label: "Branch", width: 18 },
    { key: "department", label: "Department", width: 18 },
    { key: "salaryType", label: "Salary Type", width: 15 },
    ...(canViewSalary ? [{ key: "baseSalary", label: "Base Salary", width: 14 }] : []),
    { key: "currency", label: "Currency", width: 10 },
    { key: "paymentMethod", label: "Payment Method", width: 16 },
    ...(canViewSalary ? [
      { key: "dailyRate", label: "Daily Rate", width: 12 },
      { key: "hourlyRate", label: "Hourly Rate", width: 12 },
      { key: "otMultiplier", label: "OT Multiplier", width: 14 },
    ] : []),
    { key: "lateRule", label: "Late Rule", width: 20 },
    { key: "absenceRule", label: "Absence Rule", width: 20 },
    { key: "active", label: "Active", width: 8 },
  ];

  const rows = profiles.map((profile) => ({
    employeeCode: profile.employee?.employeeCode ?? "",
    name: profile.employee?.fullName ?? "",
    branch: profile.employee?.branch?.name ?? "",
    department: profile.employee?.department?.name ?? "",
    salaryType: profile.salaryType ?? "",
    ...(canViewSalary ? {
      baseSalary: Number(profile.baseSalary ?? 0),
      dailyRate: Number(profile.dailyRate ?? 0),
      hourlyRate: Number(profile.hourlyRate ?? 0),
      otMultiplier: Number(profile.overtimeRateMultiplier ?? 0),
    } : {}),
    currency: profile.currency ?? "",
    paymentMethod: profile.paymentMethod ?? "",
    lateRule: profile.lateDeductionRule ?? "",
    absenceRule: profile.absenceDeductionRule ?? "",
    active: profile.active ? "Yes" : "No",
  }));

  const wb = createWorkbook();
  addReportHeaderSheet(wb, {
    companyName: tenant?.name ?? "Company",
    reportTitle: "Payroll Profiles Report",
    generatedBy: session.email,
    generatedAt: new Date(),
    filters: {
      "Total Profiles": String(profiles.length),
      "Active Profiles": String(activeCount),
      "Inactive Profiles": String(profiles.length - activeCount),
    },
    planNote: "Tax and social insurance are not calculated in this MVP.",
  });
  addWorksheetFromRows(wb, "Profiles", columns, rows.length > 0 ? rows : NO_RECORDS);

  const filename = excelFilename("payroll-profiles");

  await logTenantEvent({
    companyId: tid, actorId: session.sub, actorEmail: session.email,
    action: "PAYROLL_EXCEL_EXPORTED", entityType: "Report", entityId: "payroll-profiles",
    reason: "Payroll profiles report exported",
  });

  await db.reportExportLog.create({
    data: {
      companyId: tid, reportType: "payroll-profiles",
      filters: JSON.stringify({}),
      rowCount: profiles.length,
      fileName: filename,
      exportedById: session.sub,
      exportedByEmail: session.email,
    },
  });

  return sendWorkbookResponse(wb, filename);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
