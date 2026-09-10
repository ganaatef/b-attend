import { afterEach, describe, expect, it } from "vitest";
import {
  evaluatePlayIntegrityPayload,
  GooglePlayIntegrityVerificationError,
  playIntegrityRequestHash,
  type GooglePlayIntegrityConfig,
  type PlayIntegrityPayload,
} from "@/lib/attendance/providers/google-play-integrity";

const challenge = "attendance-challenge-value-with-sufficient-entropy";
const nowMs = 1_800_000_000_000;

const config: Pick<
  GooglePlayIntegrityConfig,
  "packageName" | "requireLicensed" | "requireStrongIntegrity" | "allowedCertificateDigests" | "maxTokenAgeMs"
> = {
  packageName: "com.battend.staff",
  requireLicensed: true,
  requireStrongIntegrity: false,
  allowedCertificateDigests: ["cert-digest"],
  maxTokenAgeMs: 10 * 60 * 1000,
};

function validPayload(overrides: Partial<PlayIntegrityPayload> = {}): PlayIntegrityPayload {
  return {
    requestDetails: {
      requestPackageName: config.packageName,
      requestHash: playIntegrityRequestHash(challenge),
      timestampMillis: String(nowMs - 1_000),
    },
    appIntegrity: {
      appRecognitionVerdict: "PLAY_RECOGNIZED",
      packageName: config.packageName,
      certificateSha256Digest: ["cert-digest"],
      versionCode: "42",
    },
    accountDetails: {
      appLicensingVerdict: "LICENSED",
    },
    deviceIntegrity: {
      deviceRecognitionVerdict: ["MEETS_BASIC_INTEGRITY", "MEETS_DEVICE_INTEGRITY"],
    },
    ...overrides,
  };
}

afterEach(() => {
  delete process.env.GOOGLE_PLAY_INTEGRITY_PACKAGE_NAME;
  delete process.env.GOOGLE_PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_PLAY_INTEGRITY_REQUIRE_LICENSED;
  delete process.env.GOOGLE_PLAY_INTEGRITY_REQUIRE_STRONG;
  delete process.env.GOOGLE_PLAY_INTEGRITY_CERT_SHA256;
  delete process.env.GOOGLE_PLAY_INTEGRITY_MAX_TOKEN_AGE_MS;
});

describe("Google Play Integrity verification", () => {
  it("binds the standard request hash to the one-time B-Attend challenge", () => {
    expect(playIntegrityRequestHash(challenge)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(playIntegrityRequestHash(challenge)).not.toBe(playIntegrityRequestHash(`${challenge}-other`));
  });

  it("trusts a Play-recognized, licensed app on a device meeting device integrity", () => {
    const result = evaluatePlayIntegrityPayload(validPayload(), challenge, config, nowMs);
    expect(result.deviceTrusted).toBe(true);
    expect(result.references.appRecognitionVerdict).toBe("PLAY_RECOGNIZED");
    expect(result.references.appLicensingVerdict).toBe("LICENSED");
  });

  it("rejects a token bound to a different challenge", () => {
    const payload = validPayload({
      requestDetails: {
        requestPackageName: config.packageName,
        requestHash: playIntegrityRequestHash("different-challenge"),
        timestampMillis: String(nowMs),
      },
    });
    expect(() => evaluatePlayIntegrityPayload(payload, challenge, config, nowMs)).toThrow(
      GooglePlayIntegrityVerificationError,
    );
  });

  it("rejects a token for another Android package", () => {
    const payload = validPayload({
      requestDetails: {
        requestPackageName: "com.attacker.app",
        requestHash: playIntegrityRequestHash(challenge),
        timestampMillis: String(nowMs),
      },
    });
    expect(() => evaluatePlayIntegrityPayload(payload, challenge, config, nowMs)).toThrow(
      GooglePlayIntegrityVerificationError,
    );
  });

  it("rejects stale or implausibly future tokens", () => {
    const stale = validPayload({
      requestDetails: {
        requestPackageName: config.packageName,
        requestHash: playIntegrityRequestHash(challenge),
        timestampMillis: String(nowMs - config.maxTokenAgeMs - 1),
      },
    });
    const future = validPayload({
      requestDetails: {
        requestPackageName: config.packageName,
        requestHash: playIntegrityRequestHash(challenge),
        timestampMillis: String(nowMs + 60_001),
      },
    });
    expect(() => evaluatePlayIntegrityPayload(stale, challenge, config, nowMs)).toThrow(
      GooglePlayIntegrityVerificationError,
    );
    expect(() => evaluatePlayIntegrityPayload(future, challenge, config, nowMs)).toThrow(
      GooglePlayIntegrityVerificationError,
    );
  });

  it("returns an untrusted verdict instead of throwing for a compromised device", () => {
    const payload = validPayload({
      deviceIntegrity: { deviceRecognitionVerdict: ["MEETS_BASIC_INTEGRITY"] },
    });
    const result = evaluatePlayIntegrityPayload(payload, challenge, config, nowMs);
    expect(result.deviceTrusted).toBe(false);
  });

  it("can require strong integrity for a stricter deployment", () => {
    const strict = { ...config, requireStrongIntegrity: true };
    expect(evaluatePlayIntegrityPayload(validPayload(), challenge, strict, nowMs).deviceTrusted).toBe(false);

    const strongPayload = validPayload({
      deviceIntegrity: {
        deviceRecognitionVerdict: [
          "MEETS_BASIC_INTEGRITY",
          "MEETS_DEVICE_INTEGRITY",
          "MEETS_STRONG_INTEGRITY",
        ],
      },
    });
    expect(evaluatePlayIntegrityPayload(strongPayload, challenge, strict, nowMs).deviceTrusted).toBe(true);
  });

  it("fails the trust verdict when a configured signing certificate does not match", () => {
    const payload = validPayload({
      appIntegrity: {
        appRecognitionVerdict: "PLAY_RECOGNIZED",
        packageName: config.packageName,
        certificateSha256Digest: ["other-cert"],
        versionCode: "42",
      },
    });
    expect(evaluatePlayIntegrityPayload(payload, challenge, config, nowMs).deviceTrusted).toBe(false);
  });
});
