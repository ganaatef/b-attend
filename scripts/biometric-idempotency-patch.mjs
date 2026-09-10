import fs from "node:fs";

const path = "src/lib/attendance/biometric-identity.ts";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(marker, replacement, label) {
  const count = source.split(marker).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one ${label} marker, found ${count}`);
  source = source.replace(marker, replacement);
}

// Enrollment-session creation must be idempotent. An active local session is
// returned as-is; terminal attempts advance the provider idempotency token so
// AWS issues a fresh SessionId. Concurrent retries converge through upsert on
// providerSessionId.
replaceOnce(
`  const provider = client();
  let remote;
  try {
    remote = await provider.createLivenessSession(requestToken(enrollment.id, input.userId, String(enrollment.enrollmentVersion)));
  } catch (error) {
    mapProviderError(error);
  }

  const session = await db.$transaction(async (tx) => {
    await tx.biometricVerificationSession.updateMany({
      where: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        purpose: "ENROLLMENT",
        status: { in: ["CREATED", "PROCESSING"] },
      },
      data: { status: "EXPIRED" },
    });
    await tx.biometricEnrollment.update({
      where: { id: enrollment.id },
      data: { consentVersion, consentedAt: new Date(), consentedByUserId: input.userId },
    });
    return tx.biometricVerificationSession.create({
      data: {
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

  return { ...session, provider: SESSION_PROVIDER, region: provider.config.region };`,
`  const provider = client();
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

  return { ...session, provider: SESSION_PROVIDER, region: provider.config.region };`,
"enrollment session idempotency block",
);

// One attendance challenge is bound to one liveness check. AWS explicitly
// requires a fresh SessionId for a new check, so terminal sessions force the app
// to obtain a fresh B-Attend challenge instead of resurrecting an expired AWS
// SessionId or colliding with the unique attendanceChallengeId constraint.
replaceOnce(
`  if (existing) {
    if (existing.companyId !== input.companyId || existing.employeeId !== input.employeeId || existing.userId !== input.userId) {
      throw new BiometricIdentityError("BIOMETRIC_SESSION_BINDING_MISMATCH");
    }
    if (!existing.consumedAt && existing.expiresAt > new Date() && ["CREATED", "PROCESSING", "SUCCEEDED"].includes(existing.status)) {
      return { id: existing.id, providerSessionId: existing.providerSessionId, expiresAt: existing.expiresAt, provider: SESSION_PROVIDER, region: client().config.region };
    }
  }

  const provider = client();`,
`  if (existing) {
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

  const provider = client();`,
"attendance existing-session block",
);

replaceOnce(
`  const session = await db.biometricVerificationSession.create({
    data: {
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
  });`,
`  const session = await db.biometricVerificationSession.upsert({
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
  });`,
"attendance session create block",
);

fs.writeFileSync(path, source);
console.log("Applied biometric enrollment/attendance idempotency hardening.");

// trigger: 2026-09-10T15:55Z
