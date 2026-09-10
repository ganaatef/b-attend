import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  AwsRekognitionBiometricClient,
  AwsRekognitionBiometricConfigurationError,
  AwsRekognitionBiometricError,
  biometricExternalSubject,
} from "@/lib/attendance/providers/aws-rekognition-biometric";

const SESSION_PROVIDER = "aws_rekognition";
const CONSENT_VERSION_MAX = 80;
const DEVELOPMENT_CONSENT_VERSION = "dev-biometric-consent-v1";

export type BiometricCapability = "FACE_MATCH" | "LIVENESS";

export class BiometricIdentityError extends Error {
  constructor(readonly code: string, message = code) {
    super(message);
    this.name = "BiometricIdentityError";
  }
}

export function configuredBiometricProviderKey(): string {
  return (process.env.ATTENDANCE_BIOMETRIC_PROVIDER ?? "none").trim().toLowerCase() || "none";
}

export function configuredBiometricCapabilities(): readonly BiometricCapability[] {
  const key = configuredBiometricProviderKey();
  if (key === "none") return [];
  if (key === SESSION_PROVIDER) return ["FACE_MATCH", "LIVENESS"];
  throw new BiometricIdentityError("BIOMETRIC_PROVIDER_MISCONFIGURED");
}

/**
 * Consent policy is server-controlled. Native clients may display this value and
 * echo it back, but they cannot choose an arbitrary version. Production fails
 * closed if the deployment does not pin an explicit policy version.
 */
export function currentBiometricConsentVersion(): string {
  const configured = (process.env.BIOMETRIC_CONSENT_VERSION ?? "").trim();
  if (configured) {
    if (!/^[A-Za-z0-9._:-]{1,80}$/.test(configured)) {
      throw new BiometricIdentityError("BIOMETRIC_CONSENT_CONFIG_INVALID");
    }
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    throw new BiometricIdentityError("BIOMETRIC_CONSENT_CONFIG_MISSING");
  }
  return DEVELOPMENT_CONSENT_VERSION;
}

function requireCurrentConsentVersion(consentVersion: string): string {
  const submitted = consentVersion.trim();
  if (!submitted || submitted.length > CONSENT_VERSION_MAX) {
    throw new BiometricIdentityError("BIOMETRIC_CONSENT_REQUIRED");
  }
  if (submitted !== currentBiometricConsentVersion()) {
    throw new BiometricIdentityError("BIOMETRIC_CONSENT_OUTDATED");
  }
  return submitted;
}

function client(): AwsRekognitionBiometricClient {
  if (configuredBiometricProviderKey() !== SESSION_PROVIDER) {
    throw new BiometricIdentityError("BIOMETRIC_PROVIDER_UNAVAILABLE");
  }
  try {
    return new AwsRekognitionBiometricClient();
  } catch (error) {
    if (error instanceof AwsRekognitionBiometricConfigurationError) {
      throw new BiometricIdentityError("BIOMETRIC_PROVIDER_MISCONFIGURED");
    }
    throw error;
  }
}

function requestToken(...parts: string[]): string {
  return createHash("sha256").update(parts.join(":"), "utf8").digest("base64url").slice(0, 64);
}

function mapProviderError(error: unknown): never {
  if (error instanceof BiometricIdentityError) throw error;
  if (error instanceof AwsRekognitionBiometricError) {
    throw new BiometricIdentityError(error.retryable ? "BIOMETRIC_PROVIDER_RETRYABLE" : "BIOMETRIC_PROVIDER_FAILED");
  }
  if (error instanceof AwsRekognitionBiometricConfigurationError) {
    throw new BiometricIdentityError("BIOMETRIC_PROVIDER_MISCONFIGURED");
  }
  throw error;
}

export async function requestBiometricEnrollment(input: {
  companyId: string;
  employeeId: string;
  actorUserId: string;
}) {
  const employee = await db.employee.findFirst({
    where: { id: input.employeeId, companyId: input.companyId, deletedAt: null, status: "ACTIVE" },
    select: { id: true, user: { select: { id: true, status: true, deletedAt: true } } },
  });
  if (!employee) throw new BiometricIdentityError("EMPLOYEE_NOT_FOUND");
  if (!employee.user || employee.user.status !== "ACTIVE" || employee.user.deletedAt) {
    throw new BiometricIdentityError("ACTIVE_USER_REQUIRED");
  }

  const existing = await db.biometricEnrollment.findUnique({ where: { employeeId: employee.id } });
  if (existing?.status === "ACTIVE") throw new BiometricIdentityError("BIOMETRIC_ALREADY_ENROLLED");

  const enrollment = existing
    ? await db.biometricEnrollment.update({
        where: { id: existing.id },
        data: {
          providerKey: SESSION_PROVIDER,
          status: "PENDING",
          providerFaceId: null,
          providerSubjectRef: null,
          consentVersion: null,
          consentedAt: null,
          consentedByUserId: null,
          enrolledAt: null,
          revokedAt: null,
          revokeReason: null,
        },
      })
    : await db.biometricEnrollment.create({
        data: {
          companyId: input.companyId,
          employeeId: employee.id,
          providerKey: SESSION_PROVIDER,
          status: "PENDING",
        },
      });

  await db.auditLog.create({
    data: {
      companyId: input.companyId,
      actorId: input.actorUserId,
      actorEmail: "system-resolved",
      action: "BIOMETRIC_ENROLLMENT_REQUESTED",
      entityType: "BiometricEnrollment",
      entityId: enrollment.id,
    },
  });
  return enrollment;
}

export async function createEnrollmentLivenessSession(input: {
  companyId: string;
  employeeId: string;
  userId: string;
  consentVersion: string;
}) {
  const consentVersion = requireCurrentConsentVersion(input.consentVersion);

  const enrollment = await db.biometricEnrollment.findFirst({
    where: {
      companyId: input.companyId,
      employeeId: input.employeeId,
      status: "PENDING",
      providerKey: SESSION_PROVIDER,
      employee: { user: { is: { id: input.userId, status: "ACTIVE", deletedAt: null } } },
    },
  });
  if (!enrollment) throw new BiometricIdentityError("BIOMETRIC_ENROLLMENT_NOT_REQUESTED");

  const provider = client();
  const now = new Date();
  const activeSession = await db.biometricVerificationSession.findFirst({
    where: {
      companyId: input.companyId,
      employeeId: input.employeeId,
      userId: input.userId,
      enrollmentId: enrollment.id,
      purpose: "ENROLLMENT",
      consumedAt: null,
      expiresAt: { gt: now },
      status: { in: ["CREATED", "PROCESSING", "SUCCEEDED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, providerSessionId: true, expiresAt: true },
  });
  if (activeSession) {
    await db.biometricEnrollment.update({
      where: { id: enrollment.id },
      data: { consentVersion, consentedAt: now, consentedByUserId: input.userId },
    });
    return { ...activeSession, provider: SESSION_PROVIDER, region: provider.config.region };
  }

  const attempt = await db.biometricVerificationSession.count({
    where: { enrollmentId: enrollment.id, purpose: "ENROLLMENT" },
  });
  let remote;
  try {
    remote = await provider.createLivenessSession(
      requestToken(enrollment.id, input.userId, String(enrollment.enrollmentVersion), String(attempt + 1)),
    );
  } catch (error) {
    mapProviderError(error);
  }

  const session = await db.$transaction(async (tx) => {
    await tx.biometricVerificationSession.updateMany({
      where: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        purpose: "ENROLLMENT",
        status: { in: ["CREATED", "PROCESSING", "SUCCEEDED"] },
        consumedAt: null,
      },
      data: { status: "EXPIRED" },
    });
    await tx.biometricEnrollment.update({
      where: { id: enrollment.id },
      data: { consentVersion, consentedAt: new Date(), consentedByUserId: input.userId },
    });
    return tx.biometricVerificationSession.upsert({
      where: { providerSessionId: remote.sessionId },
      update: {},
      create: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        userId: input.userId,
        purpose: "ENROLLMENT",
        providerKey: SESSION_PROVIDER,
        providerSessionId: remote.sessionId,
        enrollmentId: enrollment.id,
        status: "CREATED",
        expiresAt: remote.expiresAt,
      },
      select: { id: true, providerSessionId: true, expiresAt: true },
    });
  });

  return { ...session, provider: SESSION_PROVIDER, region: provider.config.region };
}

export async function completeEnrollmentLiveness(input: {
  companyId: string;
  employeeId: string;
  userId: string;
  sessionId: string;
}) {
  const session = await db.biometricVerificationSession.findFirst({
    where: {
      id: input.sessionId,
      companyId: input.companyId,
      employeeId: input.employeeId,
      userId: input.userId,
      purpose: "ENROLLMENT",
      providerKey: SESSION_PROVIDER,
    },
    include: { enrollment: true },
  });
  if (!session?.enrollment) throw new BiometricIdentityError("BIOMETRIC_SESSION_NOT_FOUND");
  if (session.consumedAt || session.status === "CONSUMED") throw new BiometricIdentityError("BIOMETRIC_SESSION_ALREADY_USED");
  if (session.expiresAt <= new Date()) {
    await db.biometricVerificationSession.update({ where: { id: session.id }, data: { status: "EXPIRED" } }).catch(() => undefined);
    throw new BiometricIdentityError("BIOMETRIC_SESSION_EXPIRED");
  }
  if (session.enrollment.status !== "PENDING" || !session.enrollment.consentedAt || !session.enrollment.consentVersion) {
    throw new BiometricIdentityError("BIOMETRIC_CONSENT_REQUIRED");
  }

  const provider = client();
  try {
    const result = await provider.getLivenessSessionResults(session.providerSessionId);
    if (result.status === "IN_PROGRESS" || result.status === "CREATED") {
      await db.biometricVerificationSession.update({ where: { id: session.id }, data: { status: "PROCESSING" } });
      throw new BiometricIdentityError("BIOMETRIC_SESSION_PROCESSING");
    }
    if (result.status !== "SUCCEEDED" || !result.referenceImageBytes) {
      await db.biometricVerificationSession.update({
        where: { id: session.id },
        data: { status: result.status === "EXPIRED" ? "EXPIRED" : "FAILED", failureCode: `LIVENESS_${result.status}` },
      });
      throw new BiometricIdentityError("BIOMETRIC_LIVENESS_FAILED");
    }
    if (!provider.livenessPassed(result.confidence)) {
      await db.biometricVerificationSession.update({
        where: { id: session.id },
        data: { status: "FAILED", livenessConfidence: result.confidence, failureCode: "LIVENESS_THRESHOLD" },
      });
      throw new BiometricIdentityError("BIOMETRIC_LIVENESS_FAILED");
    }

    const subject = biometricExternalSubject(input.companyId, input.employeeId);
    const duplicateMatches = await provider.searchFacesByImage(result.referenceImageBytes, provider.config.duplicateThreshold);
    const conflicting = duplicateMatches.find((match) => match.externalImageId && match.externalImageId !== subject);
    if (conflicting) {
      await db.biometricVerificationSession.update({
        where: { id: session.id },
        data: { status: "FAILED", livenessConfidence: result.confidence, failureCode: "DUPLICATE_BIOMETRIC" },
      });
      throw new BiometricIdentityError("DUPLICATE_BIOMETRIC_IDENTITY");
    }

    const oldFaceId = session.enrollment.providerFaceId;
    const newFaceId = await provider.indexFace(result.referenceImageBytes, subject);
    const now = new Date();

    try {
      await db.$transaction(async (tx) => {
        const updated = await tx.biometricEnrollment.updateMany({
          where: { id: session.enrollment!.id, companyId: input.companyId, employeeId: input.employeeId, status: "PENDING" },
          data: {
            providerFaceId: newFaceId,
            providerSubjectRef: subject,
            status: "ACTIVE",
            enrollmentVersion: { increment: 1 },
            enrolledAt: now,
            revokedAt: null,
            revokeReason: null,
            lastVerifiedAt: now,
          },
        });
        if (updated.count !== 1) throw new BiometricIdentityError("BIOMETRIC_ENROLLMENT_STATE_CHANGED");
        await tx.biometricVerificationSession.update({
          where: { id: session.id },
          data: {
            status: "CONSUMED",
            completedAt: now,
            consumedAt: now,
            livenessConfidence: result.confidence,
            faceMatchScore: 100,
            providerReference: newFaceId,
          },
        });
        await tx.auditLog.create({
          data: {
            companyId: input.companyId,
            actorId: input.userId,
            actorEmail: "self",
            action: "BIOMETRIC_ENROLLMENT_COMPLETED",
            entityType: "BiometricEnrollment",
            entityId: session.enrollment!.id,
          },
        });
      });
    } catch (error) {
      await provider.deleteFace(newFaceId).catch(() => undefined);
      throw error;
    }

    if (oldFaceId && oldFaceId !== newFaceId) {
      provider.deleteFace(oldFaceId).catch(async () => {
        await db.auditLog.create({
          data: {
            companyId: input.companyId,
            actorId: input.userId,
            actorEmail: "self",
            action: "BIOMETRIC_OLD_FACE_DELETE_FAILED",
            entityType: "BiometricEnrollment",
            entityId: session.enrollment!.id,
            reason: oldFaceId,
          },
        }).catch(() => undefined);
      });
    }

    return { ok: true, enrollmentId: session.enrollment.id, livenessConfidence: result.confidence };
  } catch (error) {
    mapProviderError(error);
  }
}

export async function acceptBiometricConsent(input: {
  companyId: string;
  employeeId: string;
  userId: string;
  consentVersion: string;
}) {
  const consentVersion = requireCurrentConsentVersion(input.consentVersion);
  const enrollment = await db.biometricEnrollment.findFirst({
    where: {
      companyId: input.companyId,
      employeeId: input.employeeId,
      status: "ACTIVE",
      providerKey: SESSION_PROVIDER,
      employee: { user: { is: { id: input.userId, status: "ACTIVE", deletedAt: null } } },
    },
    select: { id: true },
  });
  if (!enrollment) throw new BiometricIdentityError("BIOMETRIC_ENROLLMENT_REQUIRED");

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.biometricEnrollment.update({
      where: { id: enrollment.id },
      data: { consentVersion, consentedAt: now, consentedByUserId: input.userId },
    });
    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        actorId: input.userId,
        actorEmail: "self",
        action: "BIOMETRIC_CONSENT_ACCEPTED",
        entityType: "BiometricEnrollment",
        entityId: enrollment.id,
        reason: consentVersion,
      },
    });
  });
  return { ok: true, consentVersion, consentedAt: now };
}

export async function createAttendanceLivenessSession(input: {
  companyId: string;
  employeeId: string;
  userId: string;
  attendanceChallengeId: string;
}) {
  const enrollment = await db.biometricEnrollment.findFirst({
    where: {
      companyId: input.companyId,
      employeeId: input.employeeId,
      status: "ACTIVE",
      providerKey: SESSION_PROVIDER,
      providerFaceId: { not: null },
      providerSubjectRef: { not: null },
    },
  });
  if (!enrollment) throw new BiometricIdentityError("BIOMETRIC_ENROLLMENT_REQUIRED");
  if (!enrollment.consentedAt || enrollment.consentVersion !== currentBiometricConsentVersion()) {
    throw new BiometricIdentityError("BIOMETRIC_RECONSENT_REQUIRED");
  }

  const existing = await db.biometricVerificationSession.findUnique({
    where: { attendanceChallengeId: input.attendanceChallengeId },
  });
  if (existing) {
    if (existing.companyId !== input.companyId || existing.employeeId !== input.employeeId || existing.userId !== input.userId) {
      throw new BiometricIdentityError("BIOMETRIC_SESSION_BINDING_MISMATCH");
    }
    if (existing.consumedAt || existing.status === "CONSUMED") {
      throw new BiometricIdentityError("BIOMETRIC_SESSION_ALREADY_USED");
    }
    if (existing.expiresAt <= new Date() || ["FAILED", "EXPIRED"].includes(existing.status)) {
      throw new BiometricIdentityError("BIOMETRIC_NEW_CHALLENGE_REQUIRED");
    }
    if (["CREATED", "PROCESSING", "SUCCEEDED"].includes(existing.status)) {
      return { id: existing.id, providerSessionId: existing.providerSessionId, expiresAt: existing.expiresAt, provider: SESSION_PROVIDER, region: client().config.region };
    }
    throw new BiometricIdentityError("BIOMETRIC_SESSION_STATE_INVALID");
  }

  const provider = client();
  let remote;
  try {
    remote = await provider.createLivenessSession(requestToken(input.attendanceChallengeId, input.userId));
  } catch (error) {
    mapProviderError(error);
  }

  const session = await db.biometricVerificationSession.upsert({
    where: { attendanceChallengeId: input.attendanceChallengeId },
    update: {},
    create: {
      companyId: input.companyId,
      employeeId: input.employeeId,
      userId: input.userId,
      purpose: "ATTENDANCE",
      providerKey: SESSION_PROVIDER,
      providerSessionId: remote.sessionId,
      attendanceChallengeId: input.attendanceChallengeId,
      enrollmentId: enrollment.id,
      status: "CREATED",
      expiresAt: remote.expiresAt,
    },
    select: { id: true, providerSessionId: true, expiresAt: true },
  });
  return { ...session, provider: SESSION_PROVIDER, region: provider.config.region };
}

export async function verifyAttendanceBiometricSession(input: {
  companyId: string;
  employeeId: string;
  userId: string;
  attendanceChallengeId: string;
  biometricSessionId: string;
}) {
  const session = await db.biometricVerificationSession.findFirst({
    where: {
      id: input.biometricSessionId,
      companyId: input.companyId,
      employeeId: input.employeeId,
      userId: input.userId,
      purpose: "ATTENDANCE",
      attendanceChallengeId: input.attendanceChallengeId,
      providerKey: SESSION_PROVIDER,
    },
    include: { enrollment: true },
  });
  if (!session?.enrollment || session.enrollment.status !== "ACTIVE") {
    throw new BiometricIdentityError("BIOMETRIC_SESSION_NOT_FOUND");
  }
  if (session.consumedAt || session.status === "CONSUMED") throw new BiometricIdentityError("BIOMETRIC_SESSION_ALREADY_USED");
  if (session.expiresAt <= new Date()) {
    await db.biometricVerificationSession.update({ where: { id: session.id }, data: { status: "EXPIRED" } }).catch(() => undefined);
    throw new BiometricIdentityError("BIOMETRIC_SESSION_EXPIRED");
  }

  if (session.status === "SUCCEEDED" && session.livenessConfidence != null && session.faceMatchScore != null) {
    return {
      sessionId: session.id,
      livenessPassed: client().livenessPassed(session.livenessConfidence),
      livenessConfidence: session.livenessConfidence,
      faceMatchScore: session.faceMatchScore / 100,
      providerReference: session.providerReference ?? session.providerSessionId,
    };
  }

  const provider = client();
  try {
    const result = await provider.getLivenessSessionResults(session.providerSessionId);
    if (result.status === "CREATED" || result.status === "IN_PROGRESS") {
      await db.biometricVerificationSession.update({ where: { id: session.id }, data: { status: "PROCESSING" } });
      throw new BiometricIdentityError("BIOMETRIC_SESSION_PROCESSING");
    }
    if (result.status !== "SUCCEEDED" || !result.referenceImageBytes) {
      await db.biometricVerificationSession.update({
        where: { id: session.id },
        data: { status: result.status === "EXPIRED" ? "EXPIRED" : "FAILED", failureCode: `LIVENESS_${result.status}` },
      });
      throw new BiometricIdentityError("BIOMETRIC_LIVENESS_FAILED");
    }

    const matches = await provider.searchFacesByImage(result.referenceImageBytes, provider.config.faceMatchThreshold);
    const expectedFaceId = session.enrollment.providerFaceId;
    const expectedSubject = session.enrollment.providerSubjectRef;
    const expected = matches
      .filter((match) => match.faceId === expectedFaceId && (!match.externalImageId || match.externalImageId === expectedSubject))
      .sort((a, b) => b.similarity - a.similarity)[0];
    const faceSimilarity = expected?.similarity ?? 0;
    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.biometricVerificationSession.update({
        where: { id: session.id },
        data: {
          status: "SUCCEEDED",
          completedAt: now,
          livenessConfidence: result.confidence,
          faceMatchScore: faceSimilarity,
          providerReference: session.providerSessionId,
          failureCode: null,
        },
      });
      if (provider.livenessPassed(result.confidence) && faceSimilarity >= provider.config.faceMatchThreshold) {
        await tx.biometricEnrollment.update({ where: { id: session.enrollment!.id }, data: { lastVerifiedAt: now } });
      }
    });

    return {
      sessionId: session.id,
      livenessPassed: provider.livenessPassed(result.confidence),
      livenessConfidence: result.confidence,
      faceMatchScore: faceSimilarity / 100,
      providerReference: session.providerSessionId,
    };
  } catch (error) {
    mapProviderError(error);
  }
}

export async function consumeBiometricVerificationSession(
  tx: Pick<Prisma.TransactionClient, "biometricVerificationSession">,
  input: { id: string; companyId: string; employeeId: string; userId: string; attendanceChallengeId: string },
) {
  const now = new Date();
  const result = await tx.biometricVerificationSession.updateMany({
    where: {
      id: input.id,
      companyId: input.companyId,
      employeeId: input.employeeId,
      userId: input.userId,
      attendanceChallengeId: input.attendanceChallengeId,
      purpose: "ATTENDANCE",
      status: "SUCCEEDED",
      consumedAt: null,
      expiresAt: { gt: now },
    },
    data: { status: "CONSUMED", consumedAt: now },
  });
  if (result.count !== 1) throw new BiometricIdentityError("BIOMETRIC_SESSION_ALREADY_USED");
  return now;
}

export async function revokeBiometricEnrollment(input: {
  companyId: string;
  employeeId: string;
  actorUserId: string;
  reason: string;
}) {
  const enrollment = await db.biometricEnrollment.findFirst({
    where: { companyId: input.companyId, employeeId: input.employeeId, status: { in: ["ACTIVE", "PENDING", "REENROLL_REQUIRED"] } },
  });
  if (!enrollment) throw new BiometricIdentityError("BIOMETRIC_ENROLLMENT_NOT_FOUND");

  if (enrollment.providerFaceId) {
    try {
      await client().deleteFace(enrollment.providerFaceId);
    } catch (error) {
      mapProviderError(error);
    }
  }
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.biometricEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "REVOKED",
        revokedAt: now,
        revokeReason: input.reason.slice(0, 500),
        providerFaceId: null,
        providerSubjectRef: null,
      },
    });
    await tx.biometricVerificationSession.updateMany({
      where: { companyId: input.companyId, employeeId: input.employeeId, consumedAt: null },
      data: { status: "EXPIRED" },
    });
    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        actorId: input.actorUserId,
        actorEmail: "system-resolved",
        action: "BIOMETRIC_ENROLLMENT_REVOKED",
        entityType: "BiometricEnrollment",
        entityId: enrollment.id,
        reason: input.reason.slice(0, 500),
      },
    });
  });
  return { ok: true };
}
