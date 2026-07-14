/**
 * Employee Coach Summary generator.
 *
 * This module wraps the coach engine's generateEmployeeCoachSnapshot with the exact
 * function signature from the B-Coach spec:
 *   generateEmployeeCoachSummary(employeeId, periodStart, periodEnd)
 *
 * It uses real database data from:
 *   AttendanceDay, Schedule, Punch, ApprovalRequest, Employee, Branch, Department
 *
 * Returns the summary + score + level and stores the result in EmployeeCoachSnapshot.
 * Caches: if a snapshot for the same employee and period already exists, reuses it
 * unless regenerate is requested.
 */

import { db } from "@/lib/db";
import {
  generateEmployeeCoachSnapshot,
  getEmployeeAttendanceStats,
  calculateConsistencyScore,
  type DateRange,
} from "@/lib/ai/coach-engine";

export interface EmployeeCoachSummaryResult {
  positiveSummary: string;
  improvementAreas: string[];
  practicalAdvice: string;
  tomorrowAction: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  tags: string[];
  score: number;
  level: "EXCELLENT" | "GOOD" | "NEEDS_ATTENTION" | "NEEDS_SUPPORT";
  cached: boolean;
  snapshotId: string;
}

/**
 * Generate (or load cached) employee coach summary for a given period.
 *
 * @param employeeId The employee to analyze
 * @param periodStart Start of the analysis period
 * @param periodEnd End of the analysis period
 * @param options.regenerate If true, forces a fresh generation (ignores cache). Only for Owner/HR.
 * @param ctx.companyId Required for AI usage logging
 * @param ctx.userId Optional, for AI usage logging
 */
export async function generateEmployeeCoachSummary(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
  options: { regenerate?: boolean } = {},
  ctx: { companyId: string; userId?: string } = { companyId: "" },
): Promise<EmployeeCoachSummaryResult> {
  const range: DateRange = { start: periodStart, end: periodEnd };

  const result = await generateEmployeeCoachSnapshot(employeeId, range, ctx, options);

  return {
    positiveSummary: result.summary.positiveSummary,
    improvementAreas: result.summary.improvementAreas,
    practicalAdvice: result.summary.practicalAdvice,
    tomorrowAction: result.summary.tomorrowAction,
    riskLevel: result.summary.riskLevel,
    tags: result.summary.tags,
    score: result.score.score,
    level: result.score.level,
    cached: result.cached ?? false,
    snapshotId: result.snapshot.id,
  };
}

/**
 * Get the latest stored snapshot for an employee (without generating a new one).
 * Useful for display without triggering AI usage.
 */
export async function getLatestEmployeeSnapshot(employeeId: string, periodStart?: Date, periodEnd?: Date) {
  const where: any = { employeeId };
  if (periodStart) where.periodStart = periodStart;
  if (periodEnd) where.periodEnd = periodEnd;
  return db.employeeCoachSnapshot.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Quick stats for display — does not generate AI output, just reads real attendance data.
 */
export async function getEmployeeQuickStats(employeeId: string, range: DateRange) {
  const stats = await getEmployeeAttendanceStats(employeeId, range);
  const score = await calculateConsistencyScore(employeeId, range);
  return { stats, score };
}
