import type {
  AttendanceSource,
  AttendanceTrustPolicy,
  MockLocationRisk,
} from "@/lib/attendance/trust-engine";
import {
  createGooglePlayIntegrityProvider,
  GooglePlayIntegrityConfigurationError,
} from "@/lib/attendance/providers/google-play-integrity";

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
  biometricToken?: string;
}

export interface AttendanceVerificationRequest {
  companyId: string;
  employeeId: string;
  userId: string;
  challenge: string;
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

/**
 * Provider registry boundary. Production integrations must verify opaque,
 * server-verifiable artifacts. Client booleans/scores are never accepted as
 * authoritative evidence.
 */
export function getAttendanceVerificationProvider(): AttendanceVerificationProvider {
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
