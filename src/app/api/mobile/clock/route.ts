import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMobileEmployee } from "@/lib/auth/mobile";
import { haversineMeters, isInsideGeofence, recalculateAttendanceDay } from "@/lib/attendance/engine";

const ClockSchema = z.object({
  type: z.enum(["CLOCK_IN", "CLOCK_OUT"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(10_000).optional(),
  idempotencyKey: z.string().uuid(),
});

function dayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function POST(request: NextRequest) {
  const context = await requireMobileEmployee(request);
  if (!context) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = ClockSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const input = parsed.data;
  const { start, end } = dayRange();

  const [settings, schedule, lastPunch] = await Promise.all([
    db.companySettings.findUnique({ where: { companyId: context.employee.companyId } }),
    db.schedule.findUnique({
      where: { companyId_employeeId_date: { companyId: context.employee.companyId, employeeId: context.employee.id, date: start } },
      include: { shiftPolicy: { select: { allowsMobileClockIn: true, allowNoScheduleClockIn: true } } },
    }),
    db.punch.findFirst({
      where: { companyId: context.employee.companyId, employeeId: context.employee.id, timestamp: { gte: start, lt: end } },
      orderBy: { timestamp: "desc" },
    }),
  ]);

  if (settings && (!settings.enableMobileClock || !settings.enableEmployeeSelfService)) {
    return NextResponse.json({ error: "MOBILE_CLOCK_DISABLED" }, { status: 403 });
  }
  if (schedule && schedule.shiftPolicy && !schedule.shiftPolicy.allowsMobileClockIn) {
    return NextResponse.json({ error: "MOBILE_CLOCK_DISABLED" }, { status: 403 });
  }
  if (!schedule && !context.employee.defaultShiftPolicy?.allowNoScheduleClockIn && !settings?.allowNoScheduleClockIn) {
    return NextResponse.json({ error: "NO_SCHEDULE" }, { status: 422 });
  }
  if (input.type === "CLOCK_IN" && lastPunch?.type === "CLOCK_IN") {
    return NextResponse.json({ error: "ALREADY_CLOCKED_IN" }, { status: 409 });
  }
  if (input.type === "CLOCK_OUT" && (!lastPunch || lastPunch.type !== "CLOCK_IN")) {
    return NextResponse.json({ error: "CLOCK_IN_REQUIRED" }, { status: 409 });
  }

  let distanceMeters = 0;
  let insideGeofence = true;
  if (context.employee.branch?.latitude != null && context.employee.branch.longitude != null) {
    distanceMeters = haversineMeters(input.latitude, input.longitude, context.employee.branch.latitude, context.employee.branch.longitude);
    insideGeofence = isInsideGeofence(distanceMeters, context.employee.branch.geofenceRadius);
  }
  const needsApproval = !insideGeofence && (settings?.requireApprovalOutsideGeofence ?? true);
  const deviceInfo = JSON.stringify({ platform: "MOBILE_APP", idempotencyKey: input.idempotencyKey, accuracyMeters: input.accuracyMeters ?? null });

  const punch = await db.punch.create({
    data: {
      companyId: context.employee.companyId,
      employeeId: context.employee.id,
      branchId: context.employee.branchId,
      scheduleId: schedule?.id,
      type: input.type,
      timestamp: new Date(),
      latitude: input.latitude,
      longitude: input.longitude,
      distanceMeters,
      insideGeofence,
      source: "MOBILE_APP",
      status: needsApproval ? "NEEDS_APPROVAL" : "ACCEPTED",
      deviceInfo,
      userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? "B-Attend Staff",
    },
  });
  await Promise.all([
    recalculateAttendanceDay({ employeeId: context.employee.id, date: start }),
    db.auditLog.create({
      data: {
        companyId: context.employee.companyId,
        actorId: context.user.id,
        actorEmail: context.user.email,
        action: input.type,
        entityType: "Punch",
        entityId: punch.id,
        reason: "B-Attend Staff mobile app",
        afterData: JSON.stringify({ insideGeofence, distanceMeters, status: punch.status }),
      },
    }),
  ]);

  return NextResponse.json({
    id: punch.id,
    type: punch.type,
    timestamp: punch.timestamp,
    status: punch.status,
    insideGeofence,
    distanceMeters,
  }, { status: 201 });
}
