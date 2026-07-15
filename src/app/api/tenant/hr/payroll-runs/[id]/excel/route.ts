import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  createWorkbook,
  addReportHeaderSheet,
  addWorksheetFromRows,
  sendWorkbookResponse,
  excelFilename,
  type ExcelColumn,
} from "@/lib/excel/exporter";
import { getRolePermissions } from "@/lib/hr/permissions";
import { logTenantEvent } from "@/lib/auth/audit";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { formatNumber } from "@/lib/utils";
import { checkPayrollLockReadiness } from "@/app/(tenant)/hr/actions";

const EMPTY_COL: ExcelColumn[] = [
  { key: "msg", label: "Info", width: 40 },
];

const NO_RECORDS_ROW = [{ msg: "No records found." }];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === "EMPLOYEE" || session.role === "BRANCH_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tid = session.tenantId;
  const { id } = await params;
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

  const run = await db.payrollRun.findFirst({
    where: { id, companyId: tid },
    include: {
      lines: {
        include: {
          employee: {
            include: {
              branch: { select: { name: true } },
              department: { select: { name: true } },
              payrollProfile: true,
            },
          },
        },
      },
      adjustments: {
        include: {
          employee: { select: { id: true, fullName: true } },
        },
      },
    },
  });

  if (!run) {
    return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
  }

  const tenant = await db.tenant.findUnique({ where: { id: tid }, select: { name: true } });

  const monthStart = new Date(run.year, run.month - 1, 1);
  const monthEnd = new Date(run.year, run.month, 0, 23, 59, 59);

  const employeeIds = run.lines.map((l) => l.employeeId);

  const attendanceDays = employeeIds.length > 0
    ? await db.attendanceDay.findMany({
        where: {
          companyId: tid,
          employeeId: { in: employeeIds },
          date: { gte: monthStart, lte: monthEnd },
        },
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              branch: { select: { name: true } },
              department: { select: { name: true } },
              payrollProfile: true,
            },
          },
        },
        orderBy: { date: "asc" },
      })
    : [];

  const pendingAdjustments = run.adjustments.filter((a) => a.status === "PENDING");

  const totalBase = run.lines.reduce((s, l) => s + (Number(l.baseSalary) || 0), 0);
  const totalNet = run.lines.reduce((s, l) => s + (Number(l.netAmount) || 0), 0);

  const lockReadiness = await checkPayrollLockReadiness(run.id, tid);

  const wb = createWorkbook();
  addReportHeaderSheet(wb, {
    companyName: tenant?.name ?? "Company",
    reportTitle: `Payroll Run — ${run.month}/${run.year}`,
    generatedBy: session.email,
    generatedAt: new Date(),
    filters: {
      Status: run.status,
      Month: String(run.month),
      Year: String(run.year),
      "Total Lines": String(run.lines.length),
      "Total Base Salary": formatNumber(totalBase),
      "Total Net Amount": formatNumber(totalNet),
      "Lock Ready": lockReadiness.ready ? "Yes" : "No",
      "Pending Adjustments": String(lockReadiness.pendingAdjustments),
      "Pending Approval Requests": String(lockReadiness.pendingApprovalRequests),
      "Attendance Requiring Approval": String(lockReadiness.attendanceRequiresApproval),
      "Pending Attendance Statuses": String(lockReadiness.pendingAttendanceStatuses),
      "Pending Leave Requests": String(lockReadiness.pendingLeaveRequests),
      "Missing Payroll Profiles": String(lockReadiness.missingPayrollProfiles),
    },
    planNote: "Tax and social insurance are not calculated in this MVP. All outputs require accountant review before real salary payment.",
  });

  // ── Sheet 1: Payroll Lines ──
  const lineColumns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 18 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 18 },
    { key: "department", label: "Department", width: 18 },
    { key: "salaryType", label: "Salary Type", width: 15 },
    { key: "scheduledDays", label: "Scheduled Days", width: 15 },
    { key: "presentDays", label: "Present Days", width: 13 },
    { key: "absentDays", label: "Absent Days", width: 12 },
    { key: "leaveDays", label: "Leave Days", width: 12 },
    { key: "offDays", label: "Off Days", width: 10 },
    { key: "workedHours", label: "Worked Hours", width: 14 },
    { key: "otHours", label: "OT Hours", width: 10 },
    { key: "lateMin", label: "Late Min", width: 10 },
    { key: "earlyLeaveMin", label: "Early Leave Min", width: 16 },
    { key: "baseSalary", label: "Base Salary", width: 14 },
    { key: "otPay", label: "OT Pay", width: 12 },
    { key: "additions", label: "Additions", width: 13 },
    { key: "deductions", label: "Deductions", width: 13 },
    { key: "netAmount", label: "Net Amount", width: 14 },
    { key: "status", label: "Status", width: 12 },
    { key: "notes", label: "Notes", width: 30 },
  ];

  const lineRows = run.lines.map((line) => ({
    employeeCode: line.employee?.employeeCode ?? "",
    employeeName: line.employee?.fullName ?? "",
    branch: line.employee?.branch?.name ?? "",
    department: line.employee?.department?.name ?? "",
    salaryType: line.employee?.payrollProfile?.salaryType ?? "",
    scheduledDays: line.scheduledDays ?? 0,
    presentDays: line.presentDays ?? 0,
    absentDays: line.absentDays ?? 0,
    leaveDays: line.leaveDays ?? 0,
    offDays: line.offDays ?? 0,
    workedHours: Number(line.workedHours ?? 0),
    otHours: Number(line.overtimeHours ?? 0),
    lateMin: line.lateMinutes ?? 0,
    earlyLeaveMin: line.earlyLeaveMinutes ?? 0,
    baseSalary: Number(line.baseSalary ?? 0),
    otPay: 0,
    additions: Number(line.grossAdditions ?? 0),
    deductions: Number(line.grossDeductions ?? 0),
    netAmount: Number(line.netAmount ?? 0),
    status: line.status ?? "",
    notes: line.notes ?? "",
  }));

  addWorksheetFromRows(wb, "Payroll Lines", lineColumns, lineRows.length > 0 ? lineRows : NO_RECORDS_ROW);

  // ── Sheet 2: Attendance Details ──
  const attColumns: ExcelColumn[] = [
    { key: "date", label: "Date", width: 14 },
    { key: "employeeCode", label: "Employee Code", width: 18 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 18 },
    { key: "department", label: "Department", width: 18 },
    { key: "status", label: "Attendance Status", width: 20 },
    { key: "workedMinutes", label: "Worked Minutes", width: 15 },
    { key: "workedHours", label: "Worked Hours", width: 14 },
    { key: "overtimeMinutes", label: "Overtime Minutes", width: 16 },
    { key: "overtimeHours", label: "Overtime Hours", width: 14 },
    { key: "lateMinutes", label: "Late Minutes", width: 14 },
    { key: "earlyLeaveMinutes", label: "Early Leave Minutes", width: 18 },
    { key: "exceptionFlags", label: "Exception Flags", width: 20 },
    { key: "requiresApproval", label: "Requires Approval", width: 18 },
  ];

  const attRows = attendanceDays.map((ad) => {
    const exceptions: string[] = [];
    if (ad.lateMinutes > 0) exceptions.push("LATE");
    if (ad.earlyLeaveMinutes > 0) exceptions.push("EARLY_LEAVE");
    if (ad.status === "MISSING_CLOCK_OUT") exceptions.push("MISSING_CLOCK_OUT");
    if (ad.status === "OUTSIDE_GEOFENCE") exceptions.push("OUTSIDE_GEOFENCE");
    if (ad.status === "PENDING_APPROVAL") exceptions.push("PENDING_APPROVAL");

    const requiresApproval = ad.status === "PENDING_APPROVAL" || ad.status === "MISSING_CLOCK_OUT";

    return {
      date: ad.date ? new Date(ad.date).toLocaleDateString() : "",
      employeeCode: ad.employee?.employeeCode ?? "",
      employeeName: ad.employee?.fullName ?? "",
      branch: ad.employee?.branch?.name ?? "",
      department: ad.employee?.department?.name ?? "",
      status: ad.status ?? "",
      workedMinutes: ad.workedMinutes ?? 0,
      workedHours: Math.round(((ad.workedMinutes ?? 0) / 60) * 100) / 100,
      overtimeMinutes: ad.overtimeMinutes ?? 0,
      overtimeHours: Math.round(((ad.overtimeMinutes ?? 0) / 60) * 100) / 100,
      lateMinutes: ad.lateMinutes ?? 0,
      earlyLeaveMinutes: ad.earlyLeaveMinutes ?? 0,
      exceptionFlags: exceptions.join(", "),
      requiresApproval: requiresApproval ? "Yes" : "No",
    };
  });

  addWorksheetFromRows(wb, "Attendance Details", attColumns, attRows.length > 0 ? attRows : NO_RECORDS_ROW);

  // ── Sheet 3: Overtime ──
  const otColumns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 18 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 18 },
    { key: "department", label: "Department", width: 18 },
    { key: "date", label: "Date", width: 14 },
    { key: "overtimeMinutes", label: "Overtime Minutes", width: 16 },
    { key: "overtimeHours", label: "Overtime Hours", width: 14 },
    { key: "overtimePay", label: "Overtime Pay", width: 14 },
    { key: "approvalStatus", label: "Approval Status", width: 18 },
  ];

  const otRows = attendanceDays
    .filter((ad) => (ad.overtimeMinutes ?? 0) > 0)
    .map((ad) => {
      const line = run.lines.find((l) => l.employeeId === ad.employeeId);
      const profile = ad.employee?.payrollProfile;
      let hourlyRate = 0;
      let otMultiplier = 1.5;
      if (profile) {
        switch (profile.salaryType) {
          case "MONTHLY":
            hourlyRate = Math.round(profile.baseSalary / 30 / 8);
            break;
          case "DAILY":
            hourlyRate = Math.round((profile.baseSalary / 30) / 8);
            break;
          case "HOURLY":
            hourlyRate = profile.hourlyRate ?? Math.round(profile.baseSalary / 30 / 8);
            break;
        }
        otMultiplier = profile.overtimeRateMultiplier;
      }
      const otHours = Math.round(((ad.overtimeMinutes ?? 0) / 60) * 100) / 100;
      const otPay = Math.round(otHours * hourlyRate * otMultiplier);

      return {
        employeeCode: ad.employee?.employeeCode ?? "",
        employeeName: ad.employee?.fullName ?? "",
        branch: ad.employee?.branch?.name ?? "",
        department: ad.employee?.department?.name ?? "",
        date: ad.date ? new Date(ad.date).toLocaleDateString() : "",
        overtimeMinutes: ad.overtimeMinutes ?? 0,
        overtimeHours: otHours,
        overtimePay: otPay,
        approvalStatus: ad.status === "PENDING_APPROVAL" ? "Pending" : "Auto-approved",
      };
    });

  addWorksheetFromRows(wb, "Overtime", otColumns, otRows.length > 0 ? otRows : NO_RECORDS_ROW);

  // ── Sheet 4: Deductions ──
  const deductionColumns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 18 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 18 },
    { key: "department", label: "Department", width: 18 },
    { key: "deductionType", label: "Deduction Type", width: 20 },
    { key: "source", label: "Source", width: 18 },
    { key: "amount", label: "Amount", width: 14 },
    { key: "reason", label: "Reason / Calculation Note", width: 35 },
  ];

  const deductionRows: Array<Record<string, string | number>> = [];

  for (const line of run.lines) {
    const emp = line.employee;
    if (!emp) continue;
    const base = emp.payrollProfile?.baseSalary ?? 0;
    const dailyRate = Math.round(base / 30);

    if ((line.absentDays ?? 0) > 0 && emp.payrollProfile?.salaryType === "MONTHLY") {
      deductionRows.push({
        employeeCode: emp.employeeCode ?? "",
        employeeName: emp.fullName ?? "",
        branch: emp.branch?.name ?? "",
        department: emp.department?.name ?? "",
        deductionType: "Absence",
        source: "Attendance",
        amount: line.absentDays * dailyRate,
        reason: `${line.absentDays} absent days × ${dailyRate} daily rate (baseSalary/30)`,
      });
    }

    if ((line.lateMinutes ?? 0) > 0) {
      const rule = emp.payrollProfile?.lateDeductionRule;
      const numericRule = rule ? parseFloat(rule) : NaN;
      if (!isNaN(numericRule) && numericRule > 0) {
        deductionRows.push({
          employeeCode: emp.employeeCode ?? "",
          employeeName: emp.fullName ?? "",
          branch: emp.branch?.name ?? "",
          department: emp.department?.name ?? "",
          deductionType: "Late",
          source: "Attendance",
          amount: Math.round(line.lateMinutes * numericRule),
          reason: `${line.lateMinutes} late minutes × ${numericRule} per minute`,
        });
      }
    }
  }

  for (const adj of run.adjustments) {
    if (adj.status !== "APPROVED") continue;
    if (adj.type === "DEDUCTION" || adj.type === "PENALTY" || adj.type === "MANUAL_CORRECTION") {
      deductionRows.push({
        employeeCode: "",
        employeeName: adj.employee?.fullName ?? "",
        branch: "",
        department: "",
        deductionType: adj.type,
        source: "Adjustment",
        amount: Number(adj.amount),
        reason: adj.reason ?? "",
      });
    }
  }

  addWorksheetFromRows(wb, "Deductions", deductionColumns, deductionRows.length > 0 ? deductionRows : NO_RECORDS_ROW);

  // ── Sheet 5: Adjustments ──
  const adjColumns: ExcelColumn[] = [
    { key: "employee", label: "Employee", width: 25 },
    { key: "type", label: "Type", width: 18 },
    { key: "amount", label: "Amount", width: 14 },
    { key: "reason", label: "Reason", width: 30 },
    { key: "status", label: "Status", width: 14 },
    { key: "createdAt", label: "Created", width: 16 },
  ];

  const adjRows = run.adjustments.map((adj) => ({
    employee: adj.employee?.fullName ?? "",
    type: adj.type,
    amount: Number(adj.amount),
    reason: adj.reason ?? "",
    status: adj.status,
    createdAt: adj.createdAt ? new Date(adj.createdAt).toLocaleDateString() : "",
  }));

  addWorksheetFromRows(wb, "Adjustments", adjColumns, adjRows.length > 0 ? adjRows : NO_RECORDS_ROW);

  // ── Sheet 6: Pending Approvals ──
  const pendingColumns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 18 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 18 },
    { key: "department", label: "Department", width: 18 },
    { key: "approvalType", label: "Approval Type", width: 25 },
    { key: "date", label: "Date", width: 14 },
    { key: "status", label: "Status", width: 14 },
    { key: "reason", label: "Reason", width: 30 },
  ];

  const pendingRows: Array<Record<string, string>> = [];

  // 1. Pending approval requests
  const pendingApprovalRequests = employeeIds.length > 0
    ? await db.approvalRequest.findMany({
        where: {
          companyId: tid,
          employeeId: { in: employeeIds },
          date: { gte: monthStart, lte: monthEnd },
          status: "PENDING",
        },
        include: {
          employee: {
            select: { fullName: true, employeeCode: true, branch: { select: { name: true } }, department: { select: { name: true } } },
          },
        },
      })
    : [];
  for (const ar of pendingApprovalRequests) {
    pendingRows.push({
      employeeCode: ar.employee?.employeeCode ?? "",
      employeeName: ar.employee?.fullName ?? "",
      branch: ar.employee?.branch?.name ?? "",
      department: ar.employee?.department?.name ?? "",
      approvalType: `ApprovalRequest — ${ar.type}`,
      date: ar.date ? new Date(ar.date).toLocaleDateString() : "",
      status: "Pending",
      reason: ar.reason ?? "",
    });
  }

  // 2. Attendance days requiring approval
  const attRequiringApproval = attendanceDays.filter((ad) => ad.requiresApproval);
  for (const ad of attRequiringApproval) {
    pendingRows.push({
      employeeCode: ad.employee?.employeeCode ?? "",
      employeeName: ad.employee?.fullName ?? "",
      branch: ad.employee?.branch?.name ?? "",
      department: ad.employee?.department?.name ?? "",
      approvalType: "Attendance Requires Approval",
      date: ad.date ? new Date(ad.date).toLocaleDateString() : "",
      status: "Pending",
      reason: "Attendance day requires approval",
    });
  }

  // 3. Pending attendance statuses
  const pendingAttStatuses = attendanceDays.filter(
    (ad) => ad.status === "PENDING_APPROVAL" || ad.status === "MISSING_CLOCK_OUT" || ad.status === "NO_SCHEDULE"
  );
  for (const ad of pendingAttStatuses) {
    pendingRows.push({
      employeeCode: ad.employee?.employeeCode ?? "",
      employeeName: ad.employee?.fullName ?? "",
      branch: ad.employee?.branch?.name ?? "",
      department: ad.employee?.department?.name ?? "",
      approvalType: `Attendance — ${ad.status}`,
      date: ad.date ? new Date(ad.date).toLocaleDateString() : "",
      status: "Pending",
      reason: ad.status === "MISSING_CLOCK_OUT" ? "Employee did not clock out" : ad.status === "NO_SCHEDULE" ? "No schedule assigned" : "Attendance pending approval",
    });
  }

  // 4. Pending leave requests
  const pendingLeaves = employeeIds.length > 0
    ? await db.leaveRequest.findMany({
        where: {
          companyId: tid,
          employeeId: { in: employeeIds },
          status: "PENDING",
          OR: [
            { startDate: { lte: monthEnd }, endDate: { gte: monthStart } },
          ],
        },
        include: {
          employee: {
            select: { fullName: true, employeeCode: true, branch: { select: { name: true } }, department: { select: { name: true } } },
          },
        },
      })
    : [];
  for (const lr of pendingLeaves) {
    pendingRows.push({
      employeeCode: lr.employee?.employeeCode ?? "",
      employeeName: lr.employee?.fullName ?? "",
      branch: lr.employee?.branch?.name ?? "",
      department: lr.employee?.department?.name ?? "",
      approvalType: "Leave Request",
      date: lr.startDate ? new Date(lr.startDate).toLocaleDateString() : "",
      status: "Pending",
      reason: lr.reason ?? `${lr.daysCount} day(s)`,
    });
  }

  // 5. Pending payroll adjustments
  for (const adj of pendingAdjustments) {
    pendingRows.push({
      employeeCode: "",
      employeeName: adj.employee?.fullName ?? "",
      branch: "",
      department: "",
      approvalType: `Payroll Adjustment — ${adj.type}`,
      date: adj.createdAt ? new Date(adj.createdAt).toLocaleDateString() : "",
      status: "Pending",
      reason: adj.reason ?? "",
    });
  }

  addWorksheetFromRows(wb, "Pending Approvals", pendingColumns, pendingRows.length > 0 ? pendingRows : NO_RECORDS_ROW);

  // ── Sheet 7: Missing Profiles ──
  const missingProfiles = run.lines.filter((line) => !line.employee?.payrollProfile);
  const mpColumns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 18 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 18 },
    { key: "department", label: "Department", width: 18 },
  ];

  const mpRows = missingProfiles.map((line) => ({
    employeeCode: line.employee?.employeeCode ?? "",
    employeeName: line.employee?.fullName ?? "",
    branch: line.employee?.branch?.name ?? "",
    department: line.employee?.department?.name ?? "",
  }));

  addWorksheetFromRows(wb, "Missing Profiles", mpColumns, mpRows.length > 0 ? mpRows : NO_RECORDS_ROW);

  const filename = excelFilename(`payroll-run-${run.month}-${run.year}`);

  await logTenantEvent({
    companyId: tid, actorId: session.sub, actorEmail: session.email,
    action: "PAYROLL_EXCEL_EXPORTED", entityType: "PayrollRun", entityId: run.id,
    reason: `Payroll run ${run.month}/${run.year} exported`,
  });

  await db.reportExportLog.create({
    data: {
      companyId: tid, reportType: "payroll-run-report",
      filters: JSON.stringify({ month: run.month, year: run.year, status: run.status }),
      rowCount: run.lines.length,
      fileName: filename,
      exportedById: session.sub,
      exportedByEmail: session.email,
    },
  });

  return sendWorkbookResponse(wb, filename);
}
