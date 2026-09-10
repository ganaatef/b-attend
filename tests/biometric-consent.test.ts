import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BiometricIdentityError,
  currentBiometricConsentVersion,
} from "@/lib/attendance/biometric-identity";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("biometric consent policy", () => {
  it("uses a stable development-only fallback outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("BIOMETRIC_CONSENT_VERSION", "");
    expect(currentBiometricConsentVersion()).toBe("dev-biometric-consent-v1");
  });

  it("returns the server-pinned consent version", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BIOMETRIC_CONSENT_VERSION", "2026-09-10-v1");
    expect(currentBiometricConsentVersion()).toBe("2026-09-10-v1");
  });

  it("fails closed in production when the consent policy is not pinned", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BIOMETRIC_CONSENT_VERSION", "");
    expect(() => currentBiometricConsentVersion()).toThrowError(
      expect.objectContaining<Partial<BiometricIdentityError>>({ code: "BIOMETRIC_CONSENT_CONFIG_MISSING" }),
    );
  });

  it("rejects unsafe consent version identifiers", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BIOMETRIC_CONSENT_VERSION", "policy version with spaces");
    expect(() => currentBiometricConsentVersion()).toThrowError(
      expect.objectContaining<Partial<BiometricIdentityError>>({ code: "BIOMETRIC_CONSENT_CONFIG_INVALID" }),
    );
  });
});
