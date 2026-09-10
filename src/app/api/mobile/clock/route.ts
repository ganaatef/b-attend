import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMobileEmployee } from "@/lib/auth/mobile";
import { haversineMeters, isInsideGeofence, recalculateAttendanceDay } from "@/lib/attendance/engine";
import { assessAttendanceTrust } from "@/lib/attendance/trust-engine";

const ClockSchema = z.object({
  type: z.enum(["CLOCK_IN", "CLOCK_OUT"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(10_000).optional(),
  idempotencyKey: z.string().uuid(),
});

const replaySelect = {
  id: true,
  type: true,
  timestamp: true,
  status: true,
  insideGeofence: true,
  distanceMeters: true,
  deviceInfo: true,
} as const;

function dayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function storedTrust(deviceInfo: string | null) {
  if (!deviceInfo) return null;
  try {
    const parsed = JSON.parse(deviceInfo) as { trust?: unknown };
    return parsed.trust ?? null;
  } catch {
    return null;
  }
}

function replayResponse(punch: {
  id: string;
  type: string;
  timestamp: Date;
  status: string;
  insideGeofence: boolean;
  distanceMeters: number | null;
  deviceInfo: string | null;
}) {
  const { deviceInfo, ...response } = punch;
  return NextResponse.json({ ...response, trust: storedTrust(deviceInfo), idempotentReplay: true });
}

export async function POST(request: NextRequest) {
  const context = await requireMobileEmployee(request);
  if (!context) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = ClockSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const input = parsed.data;
  const { start, end } = dayRange();

  // The idempotency key becomes part of the primary key. This turns duplicate
  // network retries into a database-enforced invariant rather than a best-effort
  // pre-query, so two simultaneous retries cannot create two punches.
  const punchId = `mobile:${context.employee.id}:${input.idempotencyKey}`;
  const duplicate = await db.punch.findUnique({ where: { id: punchId }, select: replaySelect });
  if (duplicate) {
    if (duplicate.type !== input.type) {
      return NextResponse.json({ error: "IDEMPOTENCY_KEY_REUSED" }, { status: 409 });
    }
    return replayResponse(duplicate);
  }

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
  if (schedule?.shiftPolicy && !schedule.shiftPolicy.allowsMobileClockIn) {
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

  // Trust v1 is server-computed from evidence the API can currently verify.
  // Face/liveness, mock-location and device-integrity providers plug into the
  // same deterministic engine later; client assertions are never trusted as
  // authoritative anti-fraud signals.
  const trust = assessAttendanceTrust({
    source: "MOBILE_APP",
    insideGeofence,
    distanceMeters,
    accuracyMeters: input.accuracyMeters ?? null,
  });

  const geofenceReviewRequired = !insideGeofence && (settings?.requireApprovalOutsideGeofence ?? true);
  const trustReviewRequired = trust.criticalRisk || (insideGeofence && trust.decision !== "ACCEPT");
  const needsApproval = geofenceReviewRequired || trustReviewRequired;

  const persistedTrust = {
    policyVersion: trust.policyVersion,
    score: trust.score,
    riskLevel: trust.riskLevel,
    decision: trust.decision,
    criticalRisk: trust.criticalRisk,
    signals: trust.signals,
  };
  const deviceInfo = JSON.stringify({
    platform: "MOBILE_APP",
    idempotencyKey: input.idempotencyKey,
    accuracyMeters: input.accuracyMeters ?? null,
    trust: persistedTrust,
  });
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? "B-Attend Staff";

  let punch;
  try {
    punch = await db.$transaction(async (tx) => {
      const created = await tx.punch.create({
        data: {
          id: punchId,
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
          userAgent,
        },
      });

      if (needsApproval) {
        await tx.approvalRequest.create({
          data: {
            companyId: context.employee.companyId,
            employeeId: context.employee.id,
            branchId: context.employee.branchId,
            date: start,
            type: insideGeofence ? "ATTENDANCE_ADJUSTMENT" : "OUTSIDE_GEOFENCE",
            reason: insideGeofence
              ? `Attendance Trust Engine review (${trust.riskLevel}, ${trust.score}/100)`
              : `Outside geofence (${Math.round(distanceMeters)}m) — Trust ${trust.score}/100`,
            originalData: JSON.stringify({
              punchType: input.type,
              latitude: input.latitude,
              longitude: input.longitude,
              distanceMeters,
              insideGeofence,
            }),
            requestedData: JSON.stringify({ trust: persistedTrust }),
            status: "PENDING",
            requestedById: context.user.id,
            relatedPunchId: created.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          companyId: context.employee.companyId,
          actorId: context.user.id,
          actorEmail: context.user.email,
          action: input.type,
          entityType: "Punch",
          entityId: created.id,
          reason: "B-Attend Staff mobile app",
          userAgent,
          afterData: JSON.stringify({
            insideGeofence,
            distanceMeters,
            status: created.status,
            trustScore: trust.score,
            trustRisk: trust.riskLevel,
            trustDecision: trust.decision,
            trustPolicyVersion: trust.policyVersion,
            approvalCreated: needsApproval,
          }),
        },
      });

      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const replay = await db.punch.findUnique({ where: { id: punchId }, select: replaySelect });
      if (replay) {
        if (replay.type !== input.type) {
          return NextResponse.json({ error: "IDEMPOTENCY_KEY_REUSED" }, { status: 409 });
        }
        return replayResponse(replay);
      }
    }
    throw error;
  }

  await recalculateAttendanceDay({ employeeId: context.employee.id, date: start });

  return NextResponse.json({
    id: punch.id,
    type: punch.type,
    timestamp: punch.timestamp,
    status: punch.status,
    insideGeofence,
    distanceMeters,
    trust: {
      score: trust.score,
      riskLevel: trust.riskLevel,
      decision: trust.decision,
      reasons: trust.reasons,
      policyVersion: trust.policyVersion,
    },
    approvalRequired: needsApproval,
  }, { status: 201 });
}
