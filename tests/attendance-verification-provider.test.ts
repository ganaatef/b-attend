import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ATTENDANCE_TRUST_POLICY } from "@/lib/attendance/trust-engine";
import {
  AttendanceVerificationProviderConfigurationError,
  getAttendanceVerificationProvider,
  missingAttendanceVerificationCapabilities,
  requiredAttendanceVerificationCapabilities,
  sanitizeAttendanceVerificationResult,
} from "@/lib/attendance/verification-provider";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("attendance verification provider contract", () => {
  it("defaults to a capability-free provider and never invents verification", async () => {
    vi.stubEnv("ATTENDANCE_VERIFICATION_PROVIDER", "none");
    const provider = getAttendanceVerificationProvider();
    expect(provider.key).toBe("none");
    expect(provider.capabilities).toEqual([]);

    const result = await provider.verify({
      companyId: "tenant",
      employeeId: "employee",
      userId: "user",
      challenge: "challenge",
      evidence: {},
    });
    expect(result.deviceTrusted).toBeNull();
    expect(result.faceMatchScore).toBeNull();
    expect(result.livenessPassed).toBeNull();
  });

  it("fails closed for an unsupported configured provider", () => {
    vi.stubEnv("ATTENDANCE_VERIFICATION_PROVIDER", "unknown-provider");
    expect(() => getAttendanceVerificationProvider()).toThrow(AttendanceVerificationProviderConfigurationError);
  });

  it("derives native app requirements from policy without applying them to kiosk", () => {
    const policy = {
      ...DEFAULT_ATTENDANCE_TRUST_POLICY,
      requireDeviceIntegrity: true,
      requireFace: true,
      requireLiveness: true,
    };
    expect(requiredAttendanceVerificationCapabilities(policy, "MOBILE_APP")).toEqual([
      "DEVICE_INTEGRITY",
      "FACE_MATCH",
      "LIVENESS",
    ]);
    expect(requiredAttendanceVerificationCapabilities(policy, "KIOSK")).toEqual([]);
  });

  it("reports capabilities a provider cannot satisfy", () => {
    const provider = {
      key: "test",
      capabilities: ["DEVICE_INTEGRITY"] as const,
      verify: vi.fn(),
    };
    expect(missingAttendanceVerificationCapabilities(provider, ["DEVICE_INTEGRITY", "FACE_MATCH", "LIVENESS"]))
      .toEqual(["FACE_MATCH", "LIVENESS"]);
  });

  it("sanitizes normalized evidence without exposing raw input tokens", () => {
    expect(sanitizeAttendanceVerificationResult({
      provider: "test",
      verifiedAt: "2026-09-10T10:00:00.000Z",
      deviceTrusted: true,
      mockLocationRisk: "NONE",
      faceMatchScore: 0.97,
      livenessPassed: true,
      references: { verificationId: "provider-ref-123" },
    })).toEqual({
      provider: "test",
      verifiedAt: "2026-09-10T10:00:00.000Z",
      deviceTrusted: true,
      mockLocationRisk: "NONE",
      faceMatchScore: 0.97,
      livenessPassed: true,
      references: { verificationId: "provider-ref-123" },
    });
  });
});
