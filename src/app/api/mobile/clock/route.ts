import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMobileEmployee } from "@/lib/auth/mobile";
import { haversineMeters, isInsideGeofence, recalculateAttendanceDay } from "@/lib/attendance/engine";
import { assessAttendanceTrust } from "@/lib/attendance/trust-engine";
import { attendanceTrustPolicyFromSettings } from "@/lib/attendance/trust-policy";
import { persistAttendanceTrustAssessment } from "@/lib/attendance/trust-persistence";
import {
  AttendanceVerificationProviderConfigurationError,
  getAttendanceVerificationProvider,
  missingAttendanceVerificationCapabilities,
  requiredAttendanceVerificationCapabilities,
  sanitizeAttendanceVerificationResult,
  type AttendanceVerificationResult,
} from "@/lib/attendance/verification-provider";
import {
  AttendanceVerificationChallengeError,
  consumeAttendanceVerificationChallenge,
  validateAttendanceVerificationChallenge,
} from "@/lib/attendance/verification-challenge";
import { consumeBiometricVerificationSession } from "@/lib/attendance/biometric-identity";

const VerificationSchema = z.object({
  challengeId: z.string().min(1),
  challenge: z.string().min(20).max(512),
  deviceIntegrityToken: z.string().min(8).max(20_000).optional(),
  locationIntegrityToken: z.string().min(8).max(20_000).optional(),
  biometricToken: z.string().min(8).max(20_000).optional(),
}).strict().refine(
  (value) => Boolean(value.deviceIntegrityToken || value.locationIntegrityToken || value.biometricToken),
  { message: "Verification evidence is required" },
);

const ClockSchema = z.object({
  type: z.enum(["CLOCK_IN", "CLOCK_OUT"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(10_000).optional(),
  idempotencyKey: z.string().uuid(),
  verification: VerificationSchema.optional(),
}).strict();

const replaySelect = {
  id: true,
  type: true,
  timestamp: true,
  status: true,
  insideGeofence: true,
  distanceMeters: true,
  deviceInfo: true,
  trustAssessment: {
    select: {
      score: true,
      riskLevel: true,
      decision: true,
      policyVersion: true,
      reviewStatus: true,
    },
  },
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

function replayResponse(punch: Prisma.PunchGetPayload<{ select: typeof replaySelect }>) {
  const { deviceInfo, trustAssessment, ...response } = punch;
  return NextResponse.json({
    ...response,
    trust: trustAssessment ?? storedTrust(deviceInfo),
    idempotentReplay: true,
  });
}

function challengeErrorResponse(error: AttendanceVerificationChallengeError) {
  if (error.code === "CHALLENGE_ALREADY_USED") {
    return NextResponse.json({ error: "VERIFICATION_CHALLENGE_ALREADY_USED" }, { status: 409 });
  }
  if (error.code === "CHALLENGE_EXPIRED") {
    return NextResponse.json({ error: "VERIFICATION_CHALLENGE_EXPIRED" }, { status: 410 });
  }
  return NextResponse.json({ error: "VERIFICATION_CHALLENGE_INVALID" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const context = await requireMobileEmployee(request);
  if (!context) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = ClockSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const input = parsed.data;
  const { start, end } = dayRange();

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
      where: {
        companyId: context.employee.companyId,
        employeeId: context.employee.id,
        status: { not: "REJECTED" },
        timestamp: { gte: start, lt: end },
      },
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

  const trustPolicy = attendanceTrustPolicyFromSettings(settings);
  let verificationProvider;
  try {
    verificationProvider = getAttendanceVerificationProvider();
  } catch (error) {
    if (error instanceof AttendanceVerificationProviderConfigurationError) {
      return NextResponse.json({ error: "VERIFICATION_PROVIDER_MISCONFIGURED" }, { status: 503 });
    }
    throw error;
  }

  const requiredCapabilities = requiredAttendanceVerificationCapabilities(trustPolicy, "MOBILE_APP");
  const missingCapabilities = missingAttendanceVerificationCapabilities(verificationProvider, requiredCapabilities);
  if (missingCapabilities.length > 0) {
    return NextResponse.json(
      { error: "VERIFICATION_PROVIDER_UNAVAILABLE", missingCapabilities },
      { status: 503 },
    );
  }
  if (requiredCapabilities.length > 0 && !input.verification) {
    return NextResponse.json(
      { error: "VERIFICATION_REQUIRED", requiredCapabilities },
      { status: 422 },
    );
  }

  let verificationResult: AttendanceVerificationResult | null = null;
  if (input.verification) {
    if (verificationProvider.capabilities.length === 0) {
      return NextResponse.json({ error: "VERIFICATION_NOT_SUPPORTED" }, { status: 422 });
    }
    try {
      await validateAttendanceVerificationChallenge({
        id: input.verification.challengeId,
        challenge: input.verification.challenge,
        companyId: context.employee.companyId,
        employeeId: context.employee.id,
        userId: context.user.id,
        providerKey: verificationProvider.key,
      });
    } catch (error) {
      if (error instanceof AttendanceVerificationChallengeError) return challengeErrorResponse(error);
      throw error;
    }

    try {
      const verified = await verificationProvider.verify({
        companyId: context.employee.companyId,
        employeeId: context.employee.id,
        userId: context.user.id,
        challengeId: input.verification.challengeId,
        challenge: input.verification.challenge,
        requiredCapabilities,
        evidence: {
          deviceIntegrityToken: input.verification.deviceIntegrityToken,
          locationIntegrityToken: input.verification.locationIntegrityToken,
          biometricToken: input.verification.biometricToken,
        },
      });
      if (verified.provider !== verificationProvider.key) {
        return NextResponse.json({ error: "VERIFICATION_PROVIDER_INVALID_RESPONSE" }, { status: 503 });
      }
      if (
        verified.faceMatchScore != null &&
        (!Number.isFinite(verified.faceMatchScore) || verified.faceMatchScore < 0 || verified.faceMatchScore > 1)
      ) {
        return NextResponse.json({ error: "VERIFICATION_PROVIDER_INVALID_RESPONSE" }, { status: 503 });
      }
      verificationResult = verified;
    } catch {
      return NextResponse.json({ error: "VERIFICATION_PROVIDER_FAILED" }, { status: 503 });
    }
  }

  let distanceMeters = 0;
  let insideGeofence = true;
  if (context.employee.branch?.latitude != null && context.employee.branch.longitude != null) {
    distanceMeters = haversineMeters(input.latitude, input.longitude, context.employee.branch.latitude, context.employee.branch.longitude);
    insideGeofence = isInsideGeofence(distanceMeters, context.employee.branch.geofenceRadius);
  }

  const trust = assessAttendanceTrust({
    source: "MOBILE_APP",
    insideGeofence,
    distanceMeters,
    accuracyMeters: input.accuracyMeters ?? null,
    deviceTrusted: verificationResult?.deviceTrusted ?? null,
    mockLocationRisk: verificationResult?.mockLocationRisk ?? null,
    faceMatchScore: verificationResult?.faceMatchScore ?? null,
    livenessPassed: verificationResult?.livenessPassed ?? null,
  }, trustPolicy);

  const geofenceReviewRequired = !insideGeofence && (settings?.requireApprovalOutsideGeofence ?? true);
  const needsApproval = trust.decision === "REVIEW" || geofenceReviewRequired;
  const punchStatus = trust.decision === "REJECT"
    ? "REJECTED" as const
    : needsApproval
      ? "NEEDS_APPROVAL" as const
      : "ACCEPTED" as const;

  const persistedTrust = {
    policyVersion: trust.policyVersion,
    score: trust.score,
    riskLevel: trust.riskLevel,
    decision: trust.decision,
    criticalRisk: trust.criticalRisk,
    signals: trust.signals,
  };
  const sanitizedVerification = sanitizeAttendanceVerificationResult(verificationResult);
  const verificationAudit = {
    challengeId: input.verification?.challengeId ?? null,
    result: sanitizedVerification,
  };
  const deviceInfo = JSON.stringify({
    platform: "MOBILE_APP",
    idempotencyKey: input.idempotencyKey,
    accuracyMeters: input.accuracyMeters ?? null,
    verification: verificationAudit,
    trust: persistedTrust,
  });
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? "B-Attend Staff";

  let punch;
  let approvalRequestId: string | null = null;
  try {
    const result = await db.$transaction(async (tx) => {
      if (input.verification) {
        await consumeAttendanceVerificationChallenge(tx, {
          id: input.verification.challengeId,
          companyId: context.employee.companyId,
          employeeId: context.employee.id,
          userId: context.user.id,
        });
        if (input.verification.biometricToken) {
          await consumeBiometricVerificationSession(tx, {
            id: input.verification.biometricToken,
            companyId: context.employee.companyId,
            employeeId: context.employee.id,
            userId: context.user.id,
            attendanceChallengeId: input.verification.challengeId,
          });
        }
      }

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
          status: punchStatus,
          deviceInfo,
          userAgent,
        },
      });

      await persistAttendanceTrustAssessment(tx, {
        companyId: context.employee.companyId,
        punchId: created.id,
        source: "MOBILE_APP",
        assessment: trust,
        reviewStatus: punchStatus === "NEEDS_APPROVAL" ? "PENDING" : "NOT_REQUIRED",
        evidence: verificationAudit,
      });

      let requestId: string | null = null;
      if (punchStatus === "NEEDS_APPROVAL") {
        const approval = await tx.approvalRequest.create({
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
            requestedData: JSON.stringify({ trust: persistedTrust, verification: verificationAudit }),
            status: "PENDING",
            requestedById: context.user.id,
            relatedPunchId: created.id,
          },
        });
        requestId = approval.id;
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
            verificationProvider: sanitizedVerification?.provider ?? "none",
            verificationChallengeId: input.verification?.challengeId ?? null,
            approvalRequestId: requestId,
          }),
        },
      });

      return { created, requestId };
    });
    punch = result.created;
    approvalRequestId = result.requestId;
  } catch (error) {
    if (error instanceof AttendanceVerificationChallengeError) return challengeErrorResponse(error);
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
    approvalRequestId,
    verification: sanitizedVerification
      ? { provider: sanitizedVerification.provider, verifiedAt: sanitizedVerification.verifiedAt }
      : null,
    trust: {
      score: trust.score,
      riskLevel: trust.riskLevel,
      decision: trust.decision,
      reasons: trust.reasons,
      policyVersion: trust.policyVersion,
      reviewStatus: punchStatus === "NEEDS_APPROVAL" ? "PENDING" : "NOT_REQUIRED",
    },
    approvalRequired: punchStatus === "NEEDS_APPROVAL",
  }, { status: 201 });
}
