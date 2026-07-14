/**
 * GET /api/tenant/reports/csv?type=...&from=...&to=...&branchId=...
 *
 * Returns a CSV file with UTF-8 BOM.
 * Reports: daily, monthly, exceptions, overtime, branch, payroll
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logTenantEvent } from "@/lib/auth/audit";
import { toCsv, csvFilename, formatDate, formatTime, type CsvColumn, type CsvRow } from "@/lib/csv";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "daily";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const branchId = url.searchParams.get("branchId");
  const departmentId = url.searchParams.get("departmentId");

  // Build date range
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const defaultTo = today.toISOString().split("T")[0];
  const fromStr = from ?? defaultFrom;
  const toStr = to ?? defaultTo;
  const fromD = new Date(fromStr); fromD.setHours(0, 0, 0, 0);
  const toD = new Date(toStr); toD.setHours(23, 59, 59, 999);

  const where: any = {
    companyId: session.tenantId,
    date: { gte: fromD, lte: toD },
  };
  if (branchId) where.branchId = branchId;

  // Branch managers see only their branch
  if (session.role === "BRANCH_MANAGER") {
    const user = await db.user.findUnique({ where: { id: session.sub } });
    const managed = await db.branch.findMany({ where: { companyId: session.tenantId, managerId: user?.id } });
    where.branchId = { in: managed.map((b) => b.id) };
  }

  const attendance = await db.attendanceDay.findMany({
    where,
    include: { employee: { include: { branch: true, department: true } }, branch: true, schedule: { include: { shiftPolicy: true } } },
    orderBy: [{ date: "asc" }, { employee: { employeeCode: "asc" } }],
  });

  let columns: CsvColumn[] = [];
  let rows: CsvRow[] = [];
  let prefix = "report";

  if (type === "daily") {
    prefix = "daily-attendance";
    columns = [
      { key: "date", label: "Date" },
      { key: "employeeCode", label: "Employee Code" },
      { key: "employeeName", label: "Employee Name" },
      { key: "branch", label: "Branch" },
      { key: "department", label: "Department" },
      { key: "shift", label: "Shift" },
      { key: "scheduledStart", label: "Scheduled Start" },
      { key: "scheduledEnd", label: "Scheduled End" },
      { key: "clockIn", label: "Clock In" },
      { key: "clockOut", label: "Clock Out" },
      { key: "lateMinutes", label: "Late (min)" },
      { key: "earlyLeaveMinutes", label: "Early Leave (min)" },
      { key: "workedMinutes", label: "Worked (min)" },
      { key: "overtimeMinutes", label: "Overtime (min)" },
      { key: "status", label: "Status" },
      { key: "exceptionFlags", label: "Exceptions" },
      { key: "requiresApproval", label: "Requires Approval" },
    ];
    rows = attendance.map((a) => ({
      date: formatDate(a.date),
      employeeCode: a.employee?.employeeCode ?? "",
      employeeName: a.employee?.fullName ?? "",
      branch: a.branch?.name ?? "",
      department: a.employee?.department?.name ?? "",
      shift: a.schedule?.shiftPolicy?.name ?? "",
      scheduledStart: formatTime(a.scheduledStart),
      scheduledEnd: formatTime(a.scheduledEnd),
      clockIn: formatTime(a.actualClockIn),
      clockOut: formatTime(a.actualClockOut),
      lateMinutes: a.lateMinutes,
      earlyLeaveMinutes: a.earlyLeaveMinutes,
      workedMinutes: a.workedMinutes,
      overtimeMinutes: a.overtimeMinutes,
      status: a.status,
      exceptionFlags: a.exceptionFlags ?? "",
      requiresApproval: a.requiresApproval ? "YES" : "NO",
    }));
  } else if (type === "monthly") {
    prefix = "monthly-summary";
    // Group by employee
    const byEmployee = new Map<string, any>();
    for (const a of attendance) {
      const key = a.employeeId;
      if (!byEmployee.has(key)) {
        byEmployee.set(key, {
          employeeCode: a.employee?.employeeCode ?? "",
          employeeName: a.employee?.fullName ?? "",
          branch: a.employee?.branch?.name ?? "",
          department: a.employee?.department?.name ?? "",
          scheduledDays: 0, presentDays: 0, absentDays: 0, leaveDays: 0, offDays: 0, lateDays: 0,
          totalLateMinutes: 0, totalEarlyLeaveMinutes: 0, totalWorkedMinutes: 0, totalOvertimeMinutes: 0,
          missingClockOutCount: 0, outsideGeofenceCount: 0, pendingApprovalCount: 0,
        });
      }
      const r = byEmployee.get(key);
      r.scheduledDays++;
      if (["ON_TIME", "LATE", "OVERTIME", "EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"].includes(a.status)) r.presentDays++;
      if (a.status === "ABSENT") r.absentDays++;
      if (a.status === "LEAVE") r.leaveDays++;
      if (a.status === "OFF") r.offDays++;
      if (a.status === "LATE" || a.status === "LATE_AND_EARLY_LEAVE") r.lateDays++;
      r.totalLateMinutes += a.lateMinutes;
      r.totalEarlyLeaveMinutes += a.earlyLeaveMinutes;
      r.totalWorkedMinutes += a.workedMinutes;
      r.totalOvertimeMinutes += a.overtimeMinutes;
      if (a.status === "MISSING_CLOCK_OUT") r.missingClockOutCount++;
      if (a.status === "OUTSIDE_GEOFENCE" || (a.exceptionFlags?.includes("OUTSIDE_GEOFENCE"))) r.outsideGeofenceCount++;
      if (a.requiresApproval) r.pendingApprovalCount++;
    }
    columns = [
      { key: "employeeCode", label: "Employee Code" },
      { key: "employeeName", label: "Employee Name" },
      { key: "branch", label: "Branch" },
      { key: "department", label: "Department" },
      { key: "scheduledDays", label: "Scheduled Days" },
      { key: "presentDays", label: "Present Days" },
      { key: "absentDays", label: "Absent Days" },
      { key: "leaveDays", label: "Leave Days" },
      { key: "offDays", label: "Off Days" },
      { key: "lateDays", label: "Late Days" },
      { key: "totalLateMinutes", label: "Total Late (min)" },
      { key: "totalEarlyLeaveMinutes", label: "Total Early Leave (min)" },
      { key: "totalWorkedHours", label: "Total Worked (hours)" },
      { key: "totalOvertimeMinutes", label: "Total Overtime (min)" },
      { key: "missingClockOutCount", label: "Missing Clock-Out Count" },
      { key: "outsideGeofenceCount", label: "Outside Geofence Count" },
      { key: "pendingApprovalCount", label: "Pending Approval Count" },
    ];
    rows = Array.from(byEmployee.values()).map((r) => ({ ...r, totalWorkedHours: (r.totalWorkedMinutes / 60).toFixed(2) }));
  } else if (type === "exceptions") {
    prefix = "exceptions";
    const filtered = attendance.filter((a) => a.requiresApproval || a.exceptionFlags || ["LATE", "EARLY_LEAVE", "MISSING_CLOCK_OUT", "OUTSIDE_GEOFENCE", "NO_SCHEDULE", "ABSENT", "PENDING_APPROVAL"].includes(a.status));
    columns = [
      { key: "date", label: "Date" },
      { key: "employeeCode", label: "Employee Code" },
      { key: "employeeName", label: "Employee Name" },
      { key: "branch", label: "Branch" },
      { key: "status", label: "Status" },
      { key: "exceptionFlags", label: "Exceptions" },
      { key: "lateMinutes", label: "Late (min)" },
      { key: "earlyLeaveMinutes", label: "Early Leave (min)" },
      { key: "overtimeMinutes", label: "Overtime (min)" },
      { key: "requiresApproval", label: "Requires Approval" },
    ];
    rows = filtered.map((a) => ({
      date: formatDate(a.date),
      employeeCode: a.employee?.employeeCode ?? "",
      employeeName: a.employee?.fullName ?? "",
      branch: a.branch?.name ?? "",
      status: a.status,
      exceptionFlags: a.exceptionFlags ?? "",
      lateMinutes: a.lateMinutes,
      earlyLeaveMinutes: a.earlyLeaveMinutes,
      overtimeMinutes: a.overtimeMinutes,
      requiresApproval: a.requiresApproval ? "YES" : "NO",
    }));
  } else if (type === "overtime") {
    prefix = "overtime";
    const filtered = attendance.filter((a) => a.overtimeMinutes > 0);
    columns = [
      { key: "date", label: "Date" },
      { key: "employeeCode", label: "Employee Code" },
      { key: "employeeName", label: "Employee Name" },
      { key: "branch", label: "Branch" },
      { key: "overtimeMinutes", label: "Overtime (min)" },
      { key: "workedMinutes", label: "Worked (min)" },
      { key: "requiresApproval", label: "Overtime Approved" },
    ];
    rows = filtered.map((a) => ({
      date: formatDate(a.date),
      employeeCode: a.employee?.employeeCode ?? "",
      employeeName: a.employee?.fullName ?? "",
      branch: a.branch?.name ?? "",
      overtimeMinutes: a.overtimeMinutes,
      workedMinutes: a.workedMinutes,
      requiresApproval: a.requiresApproval ? "PENDING" : "APPROVED",
    }));
  } else if (type === "branch") {
    prefix = "branch-attendance";
    const byBranch = new Map<string, any>();
    for (const a of attendance) {
      const key = a.branchId ?? "none";
      if (!byBranch.has(key)) {
        byBranch.set(key, { branch: a.branch?.name ?? "—", scheduledDays: 0, presentDays: 0, absentDays: 0, lateDays: 0, workedMinutes: 0, overtimeMinutes: 0, pendingApprovals: 0, outsideGeofence: 0, missingClockOut: 0 });
      }
      const r = byBranch.get(key);
      r.scheduledDays++;
      if (["ON_TIME", "LATE", "OVERTIME", "EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"].includes(a.status)) r.presentDays++;
      if (a.status === "ABSENT") r.absentDays++;
      if (a.status === "LATE" || a.status === "LATE_AND_EARLY_LEAVE") r.lateDays++;
      r.workedMinutes += a.workedMinutes;
      r.overtimeMinutes += a.overtimeMinutes;
      if (a.requiresApproval) r.pendingApprovals++;
      if (a.exceptionFlags?.includes("OUTSIDE_GEOFENCE")) r.outsideGeofence++;
      if (a.status === "MISSING_CLOCK_OUT") r.missingClockOut++;
    }
    columns = [
      { key: "branch", label: "Branch" },
      { key: "scheduledDays", label: "Scheduled Days" },
      { key: "presentDays", label: "Present Days" },
      { key: "absentDays", label: "Absent Days" },
      { key: "lateDays", label: "Late Days" },
      { key: "workedHours", label: "Worked Hours" },
      { key: "overtimeHours", label: "Overtime Hours" },
      { key: "pendingApprovals", label: "Pending Approvals" },
      { key: "outsideGeofence", label: "Outside Geofence" },
      { key: "missingClockOut", label: "Missing Clock-Out" },
    ];
    rows = Array.from(byBranch.values()).map((r) => ({ ...r, workedHours: (r.workedMinutes / 60).toFixed(2), overtimeHours: (r.overtimeMinutes / 60).toFixed(2) }));
  } else if (type === "payroll") {
    prefix = "payroll-export";
    // Group by employee for the period
    const byEmployee = new Map<string, any>();
    for (const a of attendance) {
      const key = a.employeeId;
      if (!byEmployee.has(key)) {
        byEmployee.set(key, {
          employeeCode: a.employee?.employeeCode ?? "",
          name: a.employee?.fullName ?? "",
          branch: a.employee?.branch?.name ?? "",
          department: a.employee?.department?.name ?? "",
          scheduledDays: 0, present: 0, absent: 0, leave: 0, off: 0,
          lateMinutes: 0, earlyLeaveMinutes: 0, workedMinutes: 0, overtimeMinutes: 0,
          missingClockOutCount: 0, outsideGeofenceCount: 0, approvedAdjustments: 0, pendingApprovals: 0,
        });
      }
      const r = byEmployee.get(key);
      r.scheduledDays++;
      if (["ON_TIME", "LATE", "OVERTIME", "EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"].includes(a.status)) r.present++;
      if (a.status === "ABSENT") r.absent++;
      if (a.status === "LEAVE") r.leave++;
      if (a.status === "OFF") r.off++;
      r.lateMinutes += a.lateMinutes;
      r.earlyLeaveMinutes += a.earlyLeaveMinutes;
      r.workedMinutes += a.workedMinutes;
      r.overtimeMinutes += a.overtimeMinutes;
      if (a.status === "MISSING_CLOCK_OUT") r.missingClockOutCount++;
      if (a.exceptionFlags?.includes("OUTSIDE_GEOFENCE")) r.outsideGeofenceCount++;
      if (a.requiresApproval) r.pendingApprovals++; else r.approvedAdjustments++;
    }
    columns = [
      { key: "employeeCode", label: "Employee Code" },
      { key: "name", label: "Name" },
      { key: "branch", label: "Branch" },
      { key: "department", label: "Department" },
      { key: "scheduledDays", label: "Scheduled Days" },
      { key: "present", label: "Present" },
      { key: "absent", label: "Absent" },
      { key: "leave", label: "Leave" },
      { key: "off", label: "Off" },
      { key: "lateMinutes", label: "Late (min)" },
      { key: "earlyLeaveMinutes", label: "Early Leave (min)" },
      { key: "workedHours", label: "Worked Hours" },
      { key: "overtimeMinutes", label: "Overtime (min)" },
      { key: "missingClockOutCount", label: "Missing Clock-Out Count" },
      { key: "outsideGeofenceCount", label: "Outside Geofence Count" },
      { key: "approvedAdjustments", label: "Approved Adjustments" },
      { key: "pendingApprovals", label: "Pending Approvals" },
    ];
    rows = Array.from(byEmployee.values()).map((r) => ({ ...r, workedHours: (r.workedMinutes / 60).toFixed(2) }));
  }

  const csv = toCsv(rows, columns);
  const filename = csvFilename(prefix, { from: fromStr, to: toStr });

  // Log the export
  await logTenantEvent({
    companyId: session.tenantId,
    actorId: session.sub,
    actorEmail: session.email,
    action: "CSV_EXPORTED",
    entityType: "Report",
    entityId: type,
    reason: `${type} report ${fromStr} to ${toStr}${branchId ? ` branch=${branchId}` : ""}`,
  });
  await db.reportExportLog.create({
    data: {
      companyId: session.tenantId,
      reportType: type,
      filters: JSON.stringify({ from: fromStr, to: toStr, branchId, departmentId }),
      rowCount: rows.length,
      fileName: filename,
      exportedById: session.sub,
      exportedByEmail: session.email,
    },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
