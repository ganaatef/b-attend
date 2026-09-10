import type {
  AttendanceSource,
  AttendanceTrustPolicy,
  MockLocationRisk,
} from "@/lib/attendance/trust-engine";
import {
  createGooglePlayIntegrityProvider,
  GooglePlayIntegrityConfigurationError,
} from "@/lib/attendance/providers/google-play-integrity";
import {
  BiometricIdentityError,
  configuredBiometricCapabilities,
  configuredBiometricProviderKey,
  verifyAttendanceBiometricSession,
} from "@/lib/attendance/biometric-identity";

export const ATTENDANCE_VERIFICATION_CAPABILITIES = [
  "DEVICE_INTEGRITY",
  "MOCK_LOCATION",
  "FACE_MATCH",
  "LIVENESS",
] as const;

export type AttendanceVerificationCapability = (typeof ATTENDANCE_VERIFICATION_CAPABILITIES)[number];

/** Opaque provider artifacts only. Raw biometric media must not be submitted here. */
export interface AttendanceVerificationEvidence {
  deviceIntegrityToken?: string;
  locationIntegrityToken?: string;
  /** B-Attend local biometric verification session id; never raw camera media. */
  biometricToken?: string;
}

export interface AttendanceVerificationRequest {
  companyId: string;
  employeeId: string;
  userId: string;
  challengeId: string;
  challenge: string;
  requiredCapabilities: readonly AttendanceVerificationCapability[];
  evidence: AttendanceVerificationEvidence;
}

export interface AttendanceVerificationResult {
  provider: string;
  verifiedAt: string;
  deviceTrusted: boolean | null;
  mockLocationRisk: MockLocationRisk | null;
  faceMatchScore: number | null;
  livenessPassed: boolean | null;
  /** Provider-side non-secret references suitable for audit. Never raw tokens. */
  references: Record<string, string>;
}

export interface AttendanceVerificationProvider {
  readonly key: string;
  readonly capabilities: readonly AttendanceVerificationCapability[];
  verify(request: AttendanceVerificationRequest): Promise<AttendanceVerificationResult>;
}

export class AttendanceVerificationProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceVerificationProviderConfigurationError";
  }
}

const noopProvider: AttendanceVerificationProvider = {
  key: "none",
  capabilities: [],
  async verify() {
    return {
      provider: "none",
      verifiedAt: new Date().toISOString(),
      deviceTrusted: null,
      mockLocationRisk: null,
      faceMatchScore: null,
      livenessPassed: null,
      references: {},
    };
  },
};

function getDeviceVerificationProvider(): AttendanceVerificationProvider {
  const configured = (process.env.ATTENDANCE_VERIFICATION_PROVIDER || "none").trim().toLowerCase();
  if (configured === "" || configured === "none") return noopProvider;
  if (configured === "google_play_integrity") {
    try {
      return createGooglePlayIntegrityProvider();
    } catch (error) {
      if (error instanceof GooglePlayIntegrityConfigurationError) {
        throw new AttendanceVerificationProviderConfigurationError(error.message);
      }
      throw error;
    }
  }
  throw new AttendanceVerificationProviderConfigurationError(
    `Unsupported ATTENDANCE_VERIFICATION_PROVIDER: ${configured}`,
  );
}

function prefixed(prefix: string, values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [`${prefix}.${key}`, value]));
}

/**
 * Capability orchestrator. Device integrity and biometric identity are separate
 * adapters so Android/iOS attestation can evolve independently from Face/Liveness.
 */
export function getAttendanceVerificationProvider(): AttendanceVerificationProvider {
  const device = getDeviceVerificationProvider();
  let biometricKey: string;
  let biometricCapabilities: readonly AttendanceVerificationCapability[];
  try {
    biometricKey = configuredBiometricProviderKey();
    biometricCapabilities = configuredBiometricCapabilities();
  } catch (error) {
    if (error instanceof BiometricIdentityError) {
      throw new AttendanceVerificationProviderConfigurationError(error.message);
    }
    throw error;
  }

  const capabilities = Array.from(new Set<AttendanceVerificationCapability>([
    ...device.capabilities,
    ...biometricCapabilities,
  ]));
  if (capabilities.length === 0) return noopProvider;

  const keyParts = [device.key !== "none" ? device.key : null, biometricKey !== "none" ? biometricKey : null]
    .filter((value): value is string => Boolean(value));
  const key = keyParts.join("+");

  return {
    key,
    capabilities,
    async verify(request): Promise<AttendanceVerificationResult> {
      const required = new Set(request.requiredCapabilities);
      const requiresDevice = required.has("DEVICE_INTEGRITY");
      const requiresBiometric = required.has("FACE_MATCH") || required.has("LIVENESS");

      let deviceResult: AttendanceVerificationResult | null = null;
      if (device.key !== "none" && (requiresDevice || Boolean(request.evidence.deviceIntegrityToken))) {
        if (!request.evidence.deviceIntegrityToken) throw new Error("DEVICE_INTEGRITY_EVIDENCE_REQUIRED");
        deviceResult = await device.verify(request);
      } else if (requiresDevice) {
        throw new Error("DEVICE_INTEGRITY_PROVIDER_REQUIRED");
      }

      let faceMatchScore: number | null = null;
      let livenessPassed: boolean | null = null;
      let biometricReferences: Record<string, string> = {};
      if (biometricKey !== "none" && (requiresBiometric || Boolean(request.evidence.biometricToken))) {
        const biometricSessionId = request.evidence.biometricToken;
        if (!biometricSessionId) throw new Error("BIOMETRIC_EVIDENCE_REQUIRED");
        const result = await verifyAttendanceBiometricSession({
          companyId: request.companyId,
          employeeId: request.employeeId,
          userId: request.userId,
          attendanceChallengeId: request.challengeId,
          biometricSessionId,
        });
        faceMatchScore = result.faceMatchScore;
        livenessPassed = result.livenessPassed;
        biometricReferences = {
          sessionId: result.sessionId,
          providerReference: result.providerReference,
          livenessConfidence: result.livenessConfidence == null ? "UNKNOWN" : String(result.livenessConfidence),
        };
      } else if (requiresBiometric) {
        throw new Error("BIOMETRIC_PROVIDER_REQUIRED");
      }

      return {
        provider: key,
        verifiedAt: new Date().toISOString(),
        deviceTrusted: deviceResult?.deviceTrusted ?? null,
        mockLocationRisk: deviceResult?.mockLocationRisk ?? null,
        faceMatchScore,
        livenessPassed,
        references: {
          ...(deviceResult ? prefixed("device", deviceResult.references) : {}),
          ...prefixed("biometric", biometricReferences),
        },
      };
    },
  };
}

export function requiredAttendanceVerificationCapabilities(
  policy: AttendanceTrustPolicy,
  source: AttendanceSource,
): AttendanceVerificationCapability[] {
  if (source !== "MOBILE_APP") return [];
  const required: AttendanceVerificationCapability[] = [];
  if (policy.requireDeviceIntegrity) required.push("DEVICE_INTEGRITY");
  if (policy.requireFace) required.push("FACE_MATCH");
  if (policy.requireLiveness) required.push("LIVENESS");
  return required;
}

export function missingAttendanceVerificationCapabilities(
  provider: AttendanceVerificationProvider,
  required: readonly AttendanceVerificationCapability[],
): AttendanceVerificationCapability[] {
  const available = new Set(provider.capabilities);
  return required.filter((capability) => !available.has(capability));
}

export function sanitizeAttendanceVerificationResult(result: AttendanceVerificationResult | null) {
  if (!result) return null;
  return {
    provider: result.provider,
    verifiedAt: result.verifiedAt,
    deviceTrusted: result.deviceTrusted,
    mockLocationRisk: result.mockLocationRisk,
    faceMatchScore: result.faceMatchScore,
    livenessPassed: result.livenessPassed,
    references: result.references,
  };
}
