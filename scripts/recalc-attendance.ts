/**
 * Recalculate AttendanceDays for EMP001 from seeded punches.
 * This populates the AttendanceDay records the coach engine reads from.
 */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const tenant = await db.tenant.findUnique({ where: { slug: "b-attend-demo" } });
if (!tenant) { console.log("No demo tenant"); process.exit(1); }
const emp = await db.employee.findUnique({ where: { companyId_employeeCode: { companyId: tenant.id, employeeCode: "EMP001" } } });
if (!emp) { console.log("No EMP001"); process.exit(1); }

// Find all punches for this employee
const punches = await db.punch.findMany({ where: { employeeId: emp.id }, orderBy: { timestamp: "asc" } });
console.log(`Found ${punches.length} punches for EMP001`);

// Group punches by day
const byDay = new Map<string, typeof punches>();
for (const p of punches) {
  const day = new Date(p.timestamp); day.setHours(0, 0, 0, 0);
  const key = day.toISOString();
  if (!byDay.has(key)) byDay.set(key, []);
  byDay.get(key)!.push(p);
}

// For each day with punches, recalculate AttendanceDay
let recalcCount = 0;
for (const [dayKey, dayPunches] of byDay) {
  const date = new Date(dayKey);
  // Find schedule for this date
  const schedule = await db.schedule.findUnique({ where: { companyId_employeeId_date: { companyId: tenant.id, employeeId: emp.id, date } }, include: { shiftPolicy: true } });

  const clockIns = dayPunches.filter((p) => p.type === "CLOCK_IN" && p.status === "ACCEPTED");
  const clockOuts = dayPunches.filter((p) => p.type === "CLOCK_OUT" && p.status === "ACCEPTED");
  const actualClockIn = clockIns[0]?.timestamp ?? null;
  const actualClockOut = clockOuts[clockOuts.length - 1]?.timestamp ?? null;

  let status = "ON_TIME";
  let lateMinutes = 0;
  let workedMinutes = 0;
  let overtimeMinutes = 0;
  const exceptionFlags: string[] = [];

  if (schedule && schedule.shiftPolicy) {
    const policy = schedule.shiftPolicy;
    if (actualClockIn && schedule.expectedStart) {
      const lateMs = actualClockIn.getTime() - schedule.expectedStart.getTime();
      if (lateMs > policy.lateGraceMinutes * 60000) {
        lateMinutes = Math.round(lateMs / 60000);
        exceptionFlags.push("LATE");
        status = "LATE";
      }
    }
    if (actualClockIn && actualClockOut) {
      workedMinutes = Math.max(0, Math.round((actualClockOut.getTime() - actualClockIn.getTime()) / 60000) - policy.breakMinutes);
      if (workedMinutes > policy.overtimeStartsAfterMinutes) {
        overtimeMinutes = workedMinutes - policy.overtimeStartsAfterMinutes;
        exceptionFlags.push("OVERTIME");
        if (status === "ON_TIME") status = "OVERTIME";
      }
    }
  }

  // Upsert AttendanceDay
  const existing = await db.attendanceDay.findUnique({ where: { companyId_employeeId_date: { companyId: tenant.id, employeeId: emp.id, date } } });
  const data = {
    companyId: tenant.id,
    employeeId: emp.id,
    branchId: emp.branchId,
    scheduleId: schedule?.id ?? null,
    date,
    scheduledStart: schedule?.expectedStart ?? null,
    scheduledEnd: schedule?.expectedEnd ?? null,
    actualClockIn,
    actualClockOut,
    lateMinutes,
    breakMinutes: schedule?.shiftPolicy?.breakMinutes ?? 0,
    workedMinutes,
    overtimeMinutes,
    status: status as any,
    exceptionFlags: exceptionFlags.length > 0 ? JSON.stringify(exceptionFlags) : null,
    requiresApproval: false,
  };
  if (existing) {
    await db.attendanceDay.update({ where: { id: existing.id }, data });
  } else {
    await db.attendanceDay.create({ data });
  }
  recalcCount++;
  console.log(`  ✓ ${date.toISOString().split("T")[0]}: ${status}, late=${lateMinutes}m, worked=${workedMinutes}m, OT=${overtimeMinutes}m`);
}

// Also mark absent days (scheduled but no punch, day passed)
const now = new Date(); now.setHours(0, 0, 0, 0);
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
const schedules = await db.schedule.findMany({ where: { employeeId: emp.id, date: { gte: monthStart, lt: now }, status: "SCHEDULED" } });
let absentCount = 0;
for (const s of schedules) {
  const existing = await db.attendanceDay.findUnique({ where: { companyId_employeeId_date: { companyId: tenant.id, employeeId: emp.id, date: s.date } } });
  if (!existing) {
    const dayEnd = new Date(s.date); dayEnd.setDate(dayEnd.getDate() + 1);
    const hasPunch = await db.punch.findFirst({ where: { employeeId: emp.id, timestamp: { gte: s.date, lt: dayEnd } } });
    if (!hasPunch && s.date < now) {
      await db.attendanceDay.create({
        data: {
          companyId: tenant.id,
          employeeId: emp.id,
          branchId: s.branchId,
          scheduleId: s.id,
          date: s.date,
          scheduledStart: s.expectedStart,
          scheduledEnd: s.expectedEnd,
          status: "ABSENT",
          exceptionFlags: JSON.stringify(["ABSENT"]),
        },
      });
      absentCount++;
    }
  }
}
if (absentCount > 0) console.log(`  ✓ Marked ${absentCount} absent days`);

console.log(`\n✅ Recalculated ${recalcCount} AttendanceDays for EMP001 (+${absentCount} absent)`);
await db.$disconnect();
