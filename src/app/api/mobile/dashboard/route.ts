import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireMobileEmployee } from "@/lib/auth/mobile";

function dayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function GET(request: NextRequest) {
  const context = await requireMobileEmployee(request);
  if (!context) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { start, end } = dayRange();
  const [settings, todaySchedule, lastPunch, recentPunches] = await Promise.all([
    db.companySettings.findUnique({ where: { companyId: context.employee.companyId } }),
    db.schedule.findUnique({
      where: { companyId_employeeId_date: { companyId: context.employee.companyId, employeeId: context.employee.id, date: start } },
      include: { branch: { select: { id: true, name: true } }, shiftPolicy: { select: { name: true, allowsMobileClockIn: true } } },
    }),
    db.punch.findFirst({
      where: { companyId: context.employee.companyId, employeeId: context.employee.id, timestamp: { gte: start, lt: end } },
      orderBy: { timestamp: "desc" },
    }),
    db.punch.findMany({
      where: { companyId: context.employee.companyId, employeeId: context.employee.id },
      orderBy: { timestamp: "desc" },
      take: 10,
      select: { id: true, type: true, timestamp: true, status: true, insideGeofence: true, distanceMeters: true },
    }),
  ]);

  return NextResponse.json({
    employee: {
      id: context.employee.id,
      name: context.employee.fullName,
      arabicName: context.employee.arabicName,
      jobTitle: context.employee.jobTitle,
      branch: context.employee.branch,
    },
    mobileClockEnabled: settings?.enableMobileClock ?? true,
    todaySchedule: todaySchedule ? {
      id: todaySchedule.id,
      expectedStart: todaySchedule.expectedStart,
      expectedEnd: todaySchedule.expectedEnd,
      branch: todaySchedule.branch,
      shiftName: todaySchedule.shiftPolicy?.name ?? null,
      allowsMobileClockIn: todaySchedule.shiftPolicy?.allowsMobileClockIn ?? true,
    } : null,
    nextAction: !lastPunch || lastPunch.type === "CLOCK_OUT" ? "CLOCK_IN" : "CLOCK_OUT",
    lastPunch: lastPunch ? { type: lastPunch.type, timestamp: lastPunch.timestamp, status: lastPunch.status } : null,
    recentPunches,
  });
}
