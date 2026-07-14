/**
 * B-Coach engine — calculates consistency score + generates snapshots from real attendance data.
 *
 * Privacy rules:
 * - Score is for coaching only, never for punishment
 * - Never shame employees in any output
 * - Manager insights are factual, based on attendance records
 */

import { db } from "@/lib/db";
import {
  generateEmployeeCoachSummary,
  generateManagerTeamInsights,
  type EmployeeCoachSummaryInput,
  type ManagerTeamInsightsInput,
} from "./provider";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ConsistencyScoreResult {
  score: number;
  level: "EXCELLENT" | "GOOD" | "NEEDS_ATTENTION" | "NEEDS_SUPPORT";
  explanation: string;
  positiveSignals: string[];
  improvementSignals: string[];
}

export interface EmployeeAttendanceStats {
  scheduledDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  totalLateMinutes: number;
  earlyLeaveCount: number;
  missingClockOutCount: number;
  outsideGeofenceCount: number;
  overtimeMinutes: number;
  approvedRequests: number;
  rejectedRequests: number;
}

export async function getEmployeeAttendanceStats(employeeId: string, range: DateRange): Promise<EmployeeAttendanceStats> {
  const [schedules, attendanceDays, approvals] = await Promise.all([
    db.schedule.findMany({
      where: { employeeId, date: { gte: range.start, lte: range.end } },
    }),
    db.attendanceDay.findMany({
      where: { employeeId, date: { gte: range.start, lte: range.end } },
    }),
    db.approvalRequest.findMany({
      where: { employeeId, createdAt: { gte: range.start, lte: range.end } },
    }),
  ]);

  const scheduledDays = schedules.filter((s) => s.status === "SCHEDULED" || s.status === "ABSENT" || s.status === "LEAVE").length;
  const presentStatuses = ["ON_TIME", "LATE", "OVERTIME", "EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"];
  const presentDays = attendanceDays.filter((a) => presentStatuses.includes(a.status)).length;
  const absentDays = attendanceDays.filter((a) => a.status === "ABSENT").length;
  const lateDays = attendanceDays.filter((a) => a.status === "LATE" || a.status === "LATE_AND_EARLY_LEAVE" || (a.exceptionFlags?.includes("LATE") ?? false)).length;
  const totalLateMinutes = attendanceDays.reduce((s, a) => s + a.lateMinutes, 0);
  const earlyLeaveCount = attendanceDays.filter((a) => a.status === "EARLY_LEAVE" || a.status === "LATE_AND_EARLY_LEAVE" || (a.exceptionFlags?.includes("EARLY_LEAVE") ?? false)).length;
  const missingClockOutCount = attendanceDays.filter((a) => a.status === "MISSING_CLOCK_OUT" || (a.exceptionFlags?.includes("MISSING_CLOCK_OUT") ?? false)).length;
  const outsideGeofenceCount = attendanceDays.filter((a) => a.status === "OUTSIDE_GEOFENCE" || (a.exceptionFlags?.includes("OUTSIDE_GEOFENCE") ?? false)).length;
  const overtimeMinutes = attendanceDays.reduce((s, a) => s + a.overtimeMinutes, 0);
  const approvedRequests = approvals.filter((a) => a.status === "APPROVED").length;
  const rejectedRequests = approvals.filter((a) => a.status === "REJECTED").length;

  return {
    scheduledDays,
    presentDays,
    absentDays,
    lateDays,
    totalLateMinutes,
    earlyLeaveCount,
    missingClockOutCount,
    outsideGeofenceCount,
    overtimeMinutes,
    approvedRequests,
    rejectedRequests,
  };
}

export async function calculateConsistencyScore(employeeId: string, range: DateRange): Promise<ConsistencyScoreResult> {
  const stats = await getEmployeeAttendanceStats(employeeId, range);

  // Start from 100, deduct for issues, add small bonus for positives
  let score = 100;
  const positiveSignals: string[] = [];
  const improvementSignals: string[] = [];

  // Deductions (coaching indicators, not punishments)
  if (stats.scheduledDays > 0) {
    // Absence: -8 per absent day
    const absentDeduction = stats.absentDays * 8;
    score -= absentDeduction;
    if (stats.absentDays > 0) improvementSignals.push(`${stats.absentDays} absent day${stats.absentDays === 1 ? "" : "s"} (-${absentDeduction} points)`);

    // Late: -3 per late day, capped
    const lateDeduction = Math.min(stats.lateDays * 3, 20);
    score -= lateDeduction;
    if (stats.lateDays > 0) improvementSignals.push(`${stats.lateDays} late arrival${stats.lateDays === 1 ? "" : "s"} (-${lateDeduction} points)`);

    // Missing clock-out: -2 each, capped
    const missingDeduction = Math.min(stats.missingClockOutCount * 2, 10);
    score -= missingDeduction;
    if (stats.missingClockOutCount > 0) improvementSignals.push(`${stats.missingClockOutCount} missing clock-out${stats.missingClockOutCount === 1 ? "" : "s"} (-${missingDeduction} points)`);

    // Outside geofence: -3 each, capped
    const geofenceDeduction = Math.min(stats.outsideGeofenceCount * 3, 15);
    score -= geofenceDeduction;
    if (stats.outsideGeofenceCount > 0) improvementSignals.push(`${stats.outsideGeofenceCount} outside-geofence record${stats.outsideGeofenceCount === 1 ? "" : "s"} (-${geofenceDeduction} points)`);
  }

  // Positives
  if (stats.scheduledDays > 0 && stats.absentDays === 0) {
    score += 5;
    positiveSignals.push("Perfect attendance bonus (+5)");
  }
  if (stats.scheduledDays > 0 && stats.lateDays === 0 && stats.presentDays > 0) {
    score += 5;
    positiveSignals.push("No late arrivals bonus (+5)");
  }
  if (stats.overtimeMinutes > 0) {
    positiveSignals.push(`${Math.round(stats.overtimeMinutes / 60)} hour${Math.round(stats.overtimeMinutes / 60) === 1 ? "" : "s"} of extra effort`);
  }

  // Clamp 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let level: ConsistencyScoreResult["level"];
  if (score >= 90) level = "EXCELLENT";
  else if (score >= 75) level = "GOOD";
  else if (score >= 55) level = "NEEDS_ATTENTION";
  else level = "NEEDS_SUPPORT";

  const explanation = `Score ${score}/100 based on ${stats.scheduledDays} scheduled day${stats.scheduledDays === 1 ? "" : "s"}, ${stats.presentDays} present, ${stats.lateDays} late, ${stats.absentDays} absent. ${positiveSignals.length > 0 ? "Strengths: " + positiveSignals.join("; ") + "." : ""} ${improvementSignals.length > 0 ? "Development areas: " + improvementSignals.join("; ") + "." : "No specific development areas this period."}`;

  return { score, level, explanation, positiveSignals, improvementSignals };
}

export async function generateEmployeeCoachSnapshot(employeeId: string, range: DateRange, ctx: { companyId: string; userId?: string }) {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    include: { branch: true, department: true, user: true },
  });
  if (!employee) throw new Error("Employee not found");

  const stats = await getEmployeeAttendanceStats(employeeId, range);
  const scoreResult = await calculateConsistencyScore(employeeId, range);

  // Previous period for trend
  const periodLength = range.end.getTime() - range.start.getTime();
  const prevStart = new Date(range.start.getTime() - periodLength);
  const prevEnd = new Date(range.start.getTime() - 86400000);
  const prevStats = await getEmployeeAttendanceStats(employeeId, { start: prevStart, end: prevEnd });

  const input: EmployeeCoachSummaryInput = {
    employeeName: employee.fullName,
    employeeCode: employee.employeeCode,
    branchName: employee.branch?.name,
    departmentName: employee.department?.name,
    jobTitle: employee.jobTitle ?? undefined,
    periodStart: range.start,
    periodEnd: range.end,
    ...stats,
    previousLateDays: prevStats.lateDays,
    previousAbsentDays: prevStats.absentDays,
    score: scoreResult.score,
    level: scoreResult.level,
  };

  const summary = await generateEmployeeCoachSummary(
    { companyId: ctx.companyId, userId: ctx.userId, feature: "ai_coach" },
    input,
  );

  // Persist snapshot
  const snapshot = await db.employeeCoachSnapshot.create({
    data: {
      companyId: employee.companyId,
      employeeId: employee.id,
      periodStart: range.start,
      periodEnd: range.end,
      score: scoreResult.score,
      level: scoreResult.level as any,
      positiveSummary: summary.positiveSummary,
      improvementAreas: summary.improvementAreas,
      practicalAdvice: summary.practicalAdvice,
      tomorrowAction: summary.tomorrowAction,
      riskLevel: summary.riskLevel as any,
      tags: JSON.stringify(summary.tags),
      generatedBy: "mock",
    },
  });

  return { snapshot, summary, score: scoreResult, stats };
}

export async function generateTeamCoachSnapshot(companyId: string, branchId: string | null, range: DateRange, ctx: { userId?: string }) {
  // Get all employees in scope
  const where: any = { companyId, deletedAt: null, status: "ACTIVE" };
  if (branchId) where.branchId = branchId;

  const employees = await db.employee.findMany({
    where,
    include: { branch: true, department: true },
  });

  // Calculate score for each employee
  const employeeInputs: ManagerTeamInsightsInput["employees"] = [];
  for (const e of employees) {
    const score = await calculateConsistencyScore(e.id, range);
    const stats = await getEmployeeAttendanceStats(e.id, range);
    // Previous period for trend
    const periodLength = range.end.getTime() - range.start.getTime();
    const prevStart = new Date(range.start.getTime() - periodLength);
    const prevEnd = new Date(range.start.getTime() - 86400000);
    const prevStats = await getEmployeeAttendanceStats(e.id, { start: prevStart, end: prevEnd });
    const improving = stats.lateDays < prevStats.lateDays || stats.absentDays < prevStats.absentDays;

    let riskLevel = "LOW";
    const riskScore = stats.absentDays * 3 + stats.lateDays * 1 + stats.missingClockOutCount * 1 + stats.outsideGeofenceCount * 1;
    if (riskScore >= 8) riskLevel = "HIGH";
    else if (riskScore >= 3) riskLevel = "MEDIUM";

    employeeInputs.push({
      name: e.fullName,
      code: e.employeeCode,
      score: score.score,
      level: score.level,
      riskLevel,
      lateDays: stats.lateDays,
      absentDays: stats.absentDays,
      missingClockOut: stats.missingClockOutCount,
      outsideGeofence: stats.outsideGeofenceCount,
      improving,
    });
  }

  const branch = branchId ? await db.branch.findUnique({ where: { id: branchId } }) : null;
  const insights = await generateManagerTeamInsights(
    { companyId, userId: ctx.userId, feature: "manager_ai_insights" },
    {
      branchName: branch?.name,
      periodStart: range.start,
      periodEnd: range.end,
      totalEmployees: employees.length,
      employees: employeeInputs,
    },
  );

  // Persist snapshot
  const snapshot = await db.teamCoachSnapshot.create({
    data: {
      companyId,
      branchId,
      periodStart: range.start,
      periodEnd: range.end,
      summary: insights.summary,
      employeesNeedingSupport: JSON.stringify(insights.employeesNeedingSupport),
      employeesImproving: JSON.stringify(insights.employeesImproving),
      topConsistencyEmployees: JSON.stringify(insights.topConsistencyEmployees),
      suggestedManagerActions: JSON.stringify(insights.suggestedManagerActions),
      dailyBriefingText: insights.dailyBriefingText,
      generatedBy: "mock",
    },
  });

  return { snapshot, insights, employees: employeeInputs };
}

// Streak calculation: consecutive scheduled days with on-time or present status (no absent, no late)
export async function calculateProgressStreak(employeeId: string): Promise<number> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  // Look back up to 30 days
  const start = new Date(today); start.setDate(start.getDate() - 30);
  const attendance = await db.attendanceDay.findMany({
    where: { employeeId, date: { gte: start, lte: today } },
    orderBy: { date: "desc" },
  });

  let streak = 0;
  for (const a of attendance) {
    const isGood = a.status === "ON_TIME" || a.status === "OVERTIME";
    const hasLate = (a.exceptionFlags?.includes("LATE") ?? false) || a.status === "LATE" || a.status === "LATE_AND_EARLY_LEAVE";
    const hasAbsent = a.status === "ABSENT";
    if (isGood && !hasLate && !hasAbsent) {
      streak++;
    } else if (hasAbsent) {
      break; // streak broken
    } else {
      break; // any other status breaks the "perfect" streak
    }
  }
  return streak;
}

// Recent achievements: list of positive attendance events
export async function getRecentAchievements(employeeId: string, limit = 5): Promise<string[]> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - 30);
  const attendance = await db.attendanceDay.findMany({
    where: { employeeId, date: { gte: start, lte: today } },
    orderBy: { date: "desc" },
    take: limit * 2,
  });
  const achievements: string[] = [];
  for (const a of attendance) {
    if (a.status === "ON_TIME") achievements.push(`On-time arrival on ${new Date(a.date).toLocaleDateString()}`);
    if (a.overtimeMinutes > 0) achievements.push(`Extra ${Math.round(a.overtimeMinutes / 60)}h effort on ${new Date(a.date).toLocaleDateString()}`);
    if (achievements.length >= limit) break;
  }
  return achievements;
}
