/**
 * B-Attend attendance engine + geofence helpers.
 *
 * Haversine distance: meters between two lat/long points.
 * recalculateAttendanceDay: load employee + schedule + punches, compute metrics, upsert AttendanceDay.
 * markAbsentForPastScheduledDays: find scheduled shifts where day passed and no clock-in → mark ABSENT.
 */

import { db } from "@/lib/db";
import type { AttendanceDayStatus } from "@prisma/client";

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

export function isInsideGeofence(distanceMeters: number, radiusMeters: number): boolean {
  return distanceMeters <= radiusMeters;
}

interface RecalcOptions {
  employeeId: string;
  date: Date;
}

export async function recalculateAttendanceDay({ employeeId, date }: RecalcOptions) {
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    include: { branch: true },
  });
  if (!employee) throw new Error("Employee not found");

  const schedule = await db.schedule.findUnique({
    where: { companyId_employeeId_date: { companyId: employee.companyId, employeeId, date: dayStart } },
    include: { shiftPolicy: true },
  });

  const punches = await db.punch.findMany({
    where: { employeeId, timestamp: { gte: dayStart, lt: dayEnd } },
    orderBy: { timestamp: "asc" },
  });

  const clockIns = punches.filter((p) => p.type === "CLOCK_IN" && p.status === "ACCEPTED");
  const clockOuts = punches.filter((p) => p.type === "CLOCK_OUT" && p.status === "ACCEPTED");

  const actualClockIn = clockIns[0]?.timestamp ?? null;
  const actualClockOut = clockOuts[clockOuts.length - 1]?.timestamp ?? null;

  let status: string = "ON_TIME";
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let workedMinutes = 0;
  let overtimeMinutes = 0;
  let breakMinutes = schedule?.shiftPolicy?.breakMinutes ?? 0;
  const exceptionFlags: string[] = [];
  let requiresApproval = false;

  if (!schedule && punches.length > 0) {
    status = "NO_SCHEDULE";
    requiresApproval = true;
    if (actualClockIn && actualClockOut) {
      workedMinutes = Math.max(0, Math.round((actualClockOut.getTime() - actualClockIn.getTime()) / 60000) - breakMinutes);
    }
  } else if (schedule && schedule.status === "OFF") {
    status = "OFF";
  } else if (schedule && schedule.status === "LEAVE") {
    status = "LEAVE";
  } else if (schedule && schedule.shiftPolicy) {
    const policy = schedule.shiftPolicy;
    if (!actualClockIn && dayEnd < new Date()) {
      status = "ABSENT";
    } else if (actualClockIn && schedule.expectedStart) {
      const lateMs = actualClockIn.getTime() - schedule.expectedStart.getTime();
      if (lateMs > policy.lateGraceMinutes * 60000) {
        lateMinutes = Math.round(lateMs / 60000);
        exceptionFlags.push("LATE");
        status = "LATE";
      }
      if (actualClockOut) {
        workedMinutes = Math.max(0, Math.round((actualClockOut.getTime() - actualClockIn.getTime()) / 60000) - breakMinutes);
        if (schedule.expectedEnd) {
          const earlyMs = schedule.expectedEnd.getTime() - actualClockOut.getTime();
          if (earlyMs > policy.earlyLeaveGraceMinutes * 60000) {
            earlyLeaveMinutes = Math.round(earlyMs / 60000);
            exceptionFlags.push("EARLY_LEAVE");
            if (status === "LATE") status = "LATE_AND_EARLY_LEAVE";
            else status = "EARLY_LEAVE";
          }
        }
        if (workedMinutes > policy.overtimeStartsAfterMinutes) {
          overtimeMinutes = workedMinutes - policy.overtimeStartsAfterMinutes;
          exceptionFlags.push("OVERTIME");
          if (policy.requiresOvertimeApproval) requiresApproval = true;
          if (status === "ON_TIME") status = "OVERTIME";
        }
      } else {
        exceptionFlags.push("MISSING_CLOCK_OUT");
        status = "MISSING_CLOCK_OUT";
        requiresApproval = true;
      }
    }

    const outsideGeofence = punches.some((p) => p.insideGeofence === false);
    if (outsideGeofence) {
      exceptionFlags.push("OUTSIDE_GEOFENCE");
      requiresApproval = true;
      if (status === "ON_TIME") status = "OUTSIDE_GEOFENCE";
    }
  }

  const existing = await db.attendanceDay.findUnique({
    where: { companyId_employeeId_date: { companyId: employee.companyId, employeeId, date: dayStart } },
  });

  const data = {
    companyId: employee.companyId,
    employeeId,
    branchId: schedule?.branchId ?? employee.branchId,
    scheduleId: schedule?.id ?? null,
    date: dayStart,
    scheduledStart: schedule?.expectedStart ?? null,
    scheduledEnd: schedule?.expectedEnd ?? null,
    actualClockIn,
    actualClockOut,
    lateMinutes,
    earlyLeaveMinutes,
    breakMinutes,
    workedMinutes,
    overtimeMinutes,
    status: status as any,
    exceptionFlags: exceptionFlags.length > 0 ? JSON.stringify(exceptionFlags) : null,
    requiresApproval,
  };

  if (existing) {
    return db.attendanceDay.update({ where: { id: existing.id }, data });
  }
  return db.attendanceDay.create({ data });
}

export async function markAbsentForPastScheduledDays(opts: { companyId?: string; daysBack?: number } = {}) {
  const { companyId, daysBack = 1 } = opts;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - daysBack);

  const where: any = {
    date: { gte: cutoff, lt: today },
    status: "SCHEDULED",
  };
  if (companyId) where.companyId = companyId;

  const schedules = await db.schedule.findMany({ where, include: { employee: true } });
  if (schedules.length === 0) return { marked: 0 };

  // Batch-load all existing attendance days and punches for this date range
  const scheduleEmployeeIds = [...new Set(schedules.map(s => s.employeeId))];
  const [existingAttendanceDays, punches] = await Promise.all([
    db.attendanceDay.findMany({
      where: {
        companyId: companyId ?? undefined,
        employeeId: { in: scheduleEmployeeIds },
        date: { gte: cutoff, lt: today },
      },
      select: { employeeId: true, date: true },
    }),
    db.punch.findMany({
      where: {
        employeeId: { in: scheduleEmployeeIds },
        timestamp: { gte: cutoff, lt: today },
      },
      select: { employeeId: true, timestamp: true },
    }),
  ]);

  // Build lookup sets for O(1) checks
  const attendanceKeySet = new Set(
    existingAttendanceDays.map((a) => `${a.employeeId}:${a.date.toISOString()}`)
  );
  const punchEmployeeDates = new Set(
    punches.map((p) => {
      const d = new Date(p.timestamp); d.setHours(0, 0, 0, 0);
      return `${p.employeeId}:${d.toISOString()}`;
    })
  );

  let marked = 0;
  const toCreate: Array<{
    companyId: string; employeeId: string; branchId?: string | null; scheduleId: string;
    date: Date; scheduledStart?: Date | null; scheduledEnd?: Date | null;
    status: AttendanceDayStatus; exceptionFlags: string;
  }> = [];
  const scheduleUpdates: Array<{ id: string }> = [];

  for (const s of schedules) {
    const dateKey = `${s.employeeId}:${s.date.toISOString()}`;
    if (attendanceKeySet.has(dateKey)) continue;
    if (punchEmployeeDates.has(dateKey)) continue;

    toCreate.push({
      companyId: s.companyId,
      employeeId: s.employeeId,
      branchId: s.branchId,
      scheduleId: s.id,
      date: s.date,
      scheduledStart: s.expectedStart,
      scheduledEnd: s.expectedEnd,
      status: "ABSENT" as AttendanceDayStatus,
      exceptionFlags: JSON.stringify(["ABSENT"]),
    });
    scheduleUpdates.push({ id: s.id });
    marked++;
  }

  // Batch insert and update
  if (toCreate.length > 0) {
    await db.attendanceDay.createMany({ data: toCreate });
    await Promise.all(
      scheduleUpdates.map((su) =>
        db.schedule.update({ where: { id: su.id }, data: { status: "ABSENT" } })
      )
    );
  }

  return { marked };
}
