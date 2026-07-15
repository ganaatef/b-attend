/**
 * Payroll calculation engine.
 *
 * Generates payroll run lines from AttendanceDay data + PayrollProfile.
 * Transparent, configurable — no hardcoded tax/social insurance.
 *
 * NOTE: Tax and social insurance are NOT calculated in this MVP.
 * All outputs require accountant review before real salary payment.
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface AttendanceSummary {
  employeeId: string;
  scheduledDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  offDays: number;
  workedHours: number;
  overtimeHours: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
}

export interface PayrollCalcResult {
  employeeId: string;
  basePay: number;
  overtimePay: number;
  grossAdditions: number;
  grossDeductions: number;
  absenceDeduction: number;
  lateDeduction: number;
  netAmount: number;
  notes: string;
}

// ─────────────────────────────────────────────
// Attendance summary
// ─────────────────────────────────────────────

export async function summarizeAttendanceForPayroll(
  employeeId: string,
  companyId: string,
  year: number,
  month: number
): Promise<AttendanceSummary> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59);

  const [attendanceDays, schedules] = await Promise.all([
    db.attendanceDay.findMany({
      where: {
        employeeId,
        companyId,
        date: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { date: "asc" },
    }),
    db.schedule.findMany({
      where: {
        employeeId,
        companyId,
        date: { gte: monthStart, lte: monthEnd },
      },
    }),
  ]);

  const scheduledDays = schedules.length || attendanceDays.length;
  let presentDays = 0;
  let absentDays = 0;
  let leaveDays = 0;
  let offDays = 0;
  let totalWorkedMinutes = 0;
  let totalOvertimeMinutes = 0;
  let totalLateMinutes = 0;
  let totalEarlyLeaveMinutes = 0;

  for (const ad of attendanceDays) {
    switch (ad.status) {
      case "ON_TIME":
      case "LATE":
      case "OVERTIME":
      case "EARLY_LEAVE":
      case "LATE_AND_EARLY_LEAVE":
        presentDays++;
        break;
      case "ABSENT":
        absentDays++;
        break;
      case "LEAVE":
        leaveDays++;
        break;
      case "OFF":
        offDays++;
        break;
      default:
        break;
    }
    totalWorkedMinutes += ad.workedMinutes;
    totalOvertimeMinutes += ad.overtimeMinutes;
    totalLateMinutes += ad.lateMinutes;
    totalEarlyLeaveMinutes += ad.earlyLeaveMinutes;
  }

  return {
    employeeId,
    scheduledDays,
    presentDays,
    absentDays,
    leaveDays,
    offDays,
    workedHours: Math.round((totalWorkedMinutes / 60) * 100) / 100,
    overtimeHours: Math.round((totalOvertimeMinutes / 60) * 100) / 100,
    lateMinutes: totalLateMinutes,
    earlyLeaveMinutes: totalEarlyLeaveMinutes,
  };
}

// ─────────────────────────────────────────────
// Base pay calculations
// ─────────────────────────────────────────────

export function calculateBasePay(
  profile: { salaryType: string; baseSalary: number; dailyRate?: number | null; hourlyRate?: number | null },
  summary: AttendanceSummary,
  notes: string[]
): number {
  switch (profile.salaryType) {
    case "MONTHLY": {
      notes.push("Base pay = monthly salary (full month)");
      return profile.baseSalary;
    }
    case "DAILY": {
      const dr = profile.dailyRate ?? Math.round(profile.baseSalary / 30);
      const pay = summary.presentDays * dr;
      notes.push(`Base pay = ${summary.presentDays} present days × ${dr} daily rate`);
      return pay;
    }
    case "HOURLY": {
      const hr = profile.hourlyRate ?? Math.round(profile.baseSalary / 30 / 8);
      const pay = Math.round(summary.workedHours * hr);
      notes.push(`Base pay = ${summary.workedHours} worked hours × ${hr} hourly rate`);
      return pay;
    }
    default:
      notes.push(`Unknown salary type: ${profile.salaryType}, defaulting to 0`);
      return 0;
  }
}

export function calculateOvertimePay(
  profile: { salaryType: string; baseSalary: number; overtimeRateMultiplier: number; hourlyRate?: number | null },
  overtimeHours: number,
  notes: string[]
): number {
  if (overtimeHours <= 0) return 0;

  let hourlyRate: number;
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
    default:
      hourlyRate = 0;
  }

  const pay = Math.round(overtimeHours * hourlyRate * profile.overtimeRateMultiplier);
  notes.push(`Overtime = ${overtimeHours}h × ${hourlyRate} rate × ${profile.overtimeRateMultiplier}x multiplier`);
  return pay;
}

export function calculateAbsenceDeduction(
  profile: { salaryType: string; baseSalary: number; absenceDeductionRule?: string | null },
  absentDays: number,
  notes: string[]
): number {
  if (absentDays <= 0) return 0;
  if (profile.salaryType !== "MONTHLY") {
    notes.push(`Absence deduction skipped for ${profile.salaryType} salary (pay is per day/hour)`);
    return 0;
  }

  const dailyRate = Math.round(profile.baseSalary / 30);
  const deduction = absentDays * dailyRate;
  notes.push(`Absence deduction = ${absentDays} absent days × ${dailyRate} daily rate`);
  return deduction;
}

export function calculateLateDeduction(
  profile: { lateDeductionRule?: string | null },
  lateMinutes: number,
  notes: string[]
): number {
  if (lateMinutes <= 0) return 0;
  if (!profile.lateDeductionRule) {
    notes.push(`Late minutes: ${lateMinutes} (no deduction rule configured)`);
    return 0;
  }

  const rule = profile.lateDeductionRule;
  const numericRule = parseFloat(rule);
  if (!isNaN(numericRule)) {
    notes.push(`Late deduction = ${lateMinutes} minutes × ${numericRule} per minute`);
    return Math.round(lateMinutes * numericRule);
  }

  notes.push(`Late minutes: ${lateMinutes} (unparsed rule: ${rule})`);
  return 0;
}

// ─────────────────────────────────────────────
// Adjustments
// ─────────────────────────────────────────────

export function aggregateAdjustments(
  adjustments: Array<{ type: string; amount: number; status: string }>
): { additions: number; deductions: number } {
  let additions = 0;
  let deductions = 0;

  const ADDITION_TYPES = ["BONUS", "ALLOWANCE", "OVERTIME_ADJUSTMENT"];
  const DEDUCTION_TYPES = ["DEDUCTION", "PENALTY", "MANUAL_CORRECTION"];

  for (const adj of adjustments) {
    if (adj.status !== "APPROVED") continue;
    if (ADDITION_TYPES.includes(adj.type)) {
      additions += adj.amount;
    } else if (DEDUCTION_TYPES.includes(adj.type)) {
      deductions += adj.amount;
    }
  }

  return { additions, deductions };
}

// ─────────────────────────────────────────────
// Full line calculation
// ─────────────────────────────────────────────

export async function calculatePayrollLine(
  employeeId: string,
  companyId: string,
  year: number,
  month: number
): Promise<PayrollCalcResult> {
  const profile = await db.payrollProfile.findFirst({
    where: { employeeId, companyId, active: true },
  });

  const summary = await summarizeAttendanceForPayroll(employeeId, companyId, year, month);
  const notes: string[] = [];

  if (!profile) {
    notes.push("WARNING: No active payroll profile found. Line is a placeholder.");
    return {
      employeeId,
      basePay: 0,
      overtimePay: 0,
      grossAdditions: 0,
      grossDeductions: 0,
      absenceDeduction: 0,
      lateDeduction: 0,
      netAmount: 0,
      notes: notes.join("; "),
    };
  }

  notes.push(`Salary type: ${profile.salaryType}`);

  const basePay = calculateBasePay(profile, summary, notes);
  const overtimePay = calculateOvertimePay(profile, summary.overtimeHours, notes);
  const absenceDeduction = calculateAbsenceDeduction(profile, summary.absentDays, notes);
  const lateDeduction = calculateLateDeduction(profile, summary.lateMinutes, notes);

  notes.push("NOTE: Tax and social insurance are NOT calculated in this MVP.");

  const netAmount = basePay + overtimePay - absenceDeduction - lateDeduction;

  return {
    employeeId,
    basePay,
    overtimePay,
    grossAdditions: 0,
    grossDeductions: 0,
    absenceDeduction,
    lateDeduction,
    netAmount,
    notes: notes.join("; "),
  };
}

// ─────────────────────────────────────────────
// Run generation
// ─────────────────────────────────────────────

export interface GenerateRunOptions {
  companyId: string;
  month: number;
  year: number;
  createdById?: string;
  notes?: string;
}

export interface GenerateRunResult {
  runId: string;
  totalEmployees: number;
  linesCreated: number;
  missingProfileEmployeeIds: string[];
  warnings: string[];
}

export async function generatePayrollRun(options: GenerateRunOptions): Promise<GenerateRunResult> {
  const { companyId, month, year, createdById, notes } = options;

  const existing = await db.payrollRun.findFirst({
    where: { companyId, month, year, status: { not: "CANCELLED" } },
  });
  if (existing) {
    throw new Error(`A payroll run for ${month}/${year} already exists (status: ${existing.status}). Cancel it first to create a new one.`);
  }

  const activeEmployees = await db.employee.findMany({
    where: { companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, fullName: true, employeeCode: true },
    orderBy: { fullName: "asc" },
  });

  if (activeEmployees.length === 0) {
    throw new Error("No active employees found for this company.");
  }

  const missingProfileEmployeeIds: string[] = [];
  const warnings: string[] = [];

  const run = await db.payrollRun.create({
    data: {
      companyId,
      month,
      year,
      status: "DRAFT",
      createdById,
      notes,
    },
  });

  const lineData: Array<{
    companyId: string;
    payrollRunId: string;
    employeeId: string;
    scheduledDays: number;
    presentDays: number;
    absentDays: number;
    leaveDays: number;
    offDays: number;
    workedHours: number;
    overtimeHours: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    baseSalary: number;
    grossAdditions: number;
    grossDeductions: number;
    netAmount: number;
    notes: string;
    status: "DRAFT" | "REVIEW" | "APPROVED" | "LOCKED";
  }> = [];

  for (const emp of activeEmployees) {
    const calc = await calculatePayrollLine(emp.id, companyId, year, month);
    const summary = await summarizeAttendanceForPayroll(emp.id, companyId, year, month);

    if (!calc.notes.includes("WARNING: No active payroll profile")) {
      missingProfileEmployeeIds.push(emp.id);
      warnings.push(`${emp.fullName} (${emp.employeeCode}): No active payroll profile — line created with zero amounts.`);
    }

    lineData.push({
      companyId,
      payrollRunId: run.id,
      employeeId: emp.id,
      scheduledDays: summary.scheduledDays,
      presentDays: summary.presentDays,
      absentDays: summary.absentDays,
      leaveDays: summary.leaveDays,
      offDays: summary.offDays,
      workedHours: summary.workedHours,
      overtimeHours: summary.overtimeHours,
      lateMinutes: summary.lateMinutes,
      earlyLeaveMinutes: summary.earlyLeaveMinutes,
      baseSalary: calc.basePay,
      grossAdditions: calc.grossAdditions,
      grossDeductions: calc.grossDeductions,
      netAmount: calc.netAmount,
      notes: calc.notes,
      status: "DRAFT",
    });
  }

  await db.payrollRunLine.createMany({ data: lineData });

  return {
    runId: run.id,
    totalEmployees: activeEmployees.length,
    linesCreated: lineData.length,
    missingProfileEmployeeIds,
    warnings,
  };
}

// ─────────────────────────────────────────────
// Recalculate a single line
// ─────────────────────────────────────────────

export async function recalculateSingleLine(
  lineId: string,
  companyId: string
): Promise<{ ok: boolean; error?: string }> {
  const line = await db.payrollRunLine.findFirst({
    where: { id: lineId, companyId },
    include: { payrollRun: true },
  });
  if (!line) return { ok: false, error: "Line not found" };
  if (line.payrollRun.status === "LOCKED") return { ok: false, error: "Cannot recalculate a locked payroll run" };

  const calc = await calculatePayrollLine(line.employeeId, companyId, line.payrollRun.year, line.payrollRun.month);

  await db.payrollRunLine.update({
    where: { id: lineId },
    data: {
      baseSalary: calc.basePay,
      grossAdditions: calc.grossAdditions,
      grossDeductions: calc.grossDeductions,
      netAmount: calc.netAmount,
      notes: calc.notes,
    },
  });

  return { ok: true };
}
