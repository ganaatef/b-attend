import fs from "node:fs";

const path = "src/lib/attendance/biometric-identity.ts";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(marker, replacement, label) {
  const count = source.split(marker).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one ${label} marker, found ${count}`);
  source = source.replace(marker, replacement);
}

replaceOnce(
`const SESSION_PROVIDER = "aws_rekognition";
const CONSENT_VERSION_MAX = 80;`,
`const SESSION_PROVIDER = "aws_rekognition";
const CONSENT_VERSION_MAX = 80;
const DEVELOPMENT_CONSENT_VERSION = "dev-biometric-consent-v1";`,
"biometric constants",
);

replaceOnce(
`export function configuredBiometricCapabilities(): readonly BiometricCapability[] {
  const key = configuredBiometricProviderKey();
  if (key === "none") return [];
  if (key === SESSION_PROVIDER) return ["FACE_MATCH", "LIVENESS"];
  throw new BiometricIdentityError("BIOMETRIC_PROVIDER_MISCONFIGURED");
}
`,
`export function configuredBiometricCapabilities(): readonly BiometricCapability[] {
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
`,
"consent policy helper",
);

replaceOnce(
`  const consentVersion = input.consentVersion.trim();
  if (!consentVersion || consentVersion.length > CONSENT_VERSION_MAX) {
    throw new BiometricIdentityError("BIOMETRIC_CONSENT_REQUIRED");
  }
`,
`  const consentVersion = requireCurrentConsentVersion(input.consentVersion);
`,
"enrollment consent validation",
);

replaceOnce(
`export async function createAttendanceLivenessSession(input: {
  companyId: string;
  employeeId: string;
  userId: string;
  attendanceChallengeId: string;
}) {`,
`export async function acceptBiometricConsent(input: {
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
}) {`,
"consent acceptance insertion point",
);

replaceOnce(
`  if (!enrollment) throw new BiometricIdentityError("BIOMETRIC_ENROLLMENT_REQUIRED");

  const existing = await db.biometricVerificationSession.findUnique({`,
`  if (!enrollment) throw new BiometricIdentityError("BIOMETRIC_ENROLLMENT_REQUIRED");
  if (!enrollment.consentedAt || enrollment.consentVersion !== currentBiometricConsentVersion()) {
    throw new BiometricIdentityError("BIOMETRIC_RECONSENT_REQUIRED");
  }

  const existing = await db.biometricVerificationSession.findUnique({`,
"attendance current consent gate",
);

fs.writeFileSync(path, source);
console.log("Applied server-controlled biometric consent policy.");
