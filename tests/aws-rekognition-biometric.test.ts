import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AwsRekognitionBiometricClient,
  AwsRekognitionBiometricConfigurationError,
  AwsRekognitionBiometricError,
  biometricExternalSubject,
  buildAwsRekognitionSigV4Headers,
  loadAwsRekognitionBiometricConfig,
  type AwsRekognitionBiometricConfig,
} from "@/lib/attendance/providers/aws-rekognition-biometric";

const config: AwsRekognitionBiometricConfig = {
  region: "eu-west-1",
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "secret-example-key",
  sessionToken: "session-token",
  collectionId: "b-attend-prod",
  livenessThreshold: 90,
  faceMatchThreshold: 90,
  duplicateThreshold: 97,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-10T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("AWS Rekognition biometric adapter", () => {
  it("derives an opaque, deterministic external subject without exposing tenant or employee ids", () => {
    const subject = biometricExternalSubject("tenant-secret-id", "employee-secret-id");
    expect(subject).toMatch(/^ba_[a-f0-9]{48}$/);
    expect(subject).toBe(biometricExternalSubject("tenant-secret-id", "employee-secret-id"));
    expect(subject).not.toContain("tenant-secret-id");
    expect(subject).not.toContain("employee-secret-id");
  });

  it("fails closed for a Rekognition region that does not support Face Liveness streaming", () => {
    vi.stubEnv("AWS_REKOGNITION_REGION", "me-south-1");
    vi.stubEnv("AWS_REKOGNITION_ACCESS_KEY_ID", "access-key-at-least-16");
    vi.stubEnv("AWS_REKOGNITION_SECRET_ACCESS_KEY", "secret-key-that-is-at-least-32-characters");
    vi.stubEnv("AWS_REKOGNITION_COLLECTION_ID", "collection");

    expect(() => loadAwsRekognitionBiometricConfig()).toThrow(AwsRekognitionBiometricConfigurationError);
    expect(() => loadAwsRekognitionBiometricConfig()).toThrow(/does not support Face Liveness/);
  });

  it("fails closed when duplicate detection is weaker than face matching", () => {
    vi.stubEnv("AWS_REKOGNITION_REGION", "eu-west-1");
    vi.stubEnv("AWS_REKOGNITION_ACCESS_KEY_ID", "key");
    vi.stubEnv("AWS_REKOGNITION_SECRET_ACCESS_KEY", "secret");
    vi.stubEnv("AWS_REKOGNITION_COLLECTION_ID", "collection");
    vi.stubEnv("AWS_REKOGNITION_FACE_MATCH_THRESHOLD", "95");
    vi.stubEnv("AWS_REKOGNITION_DUPLICATE_THRESHOLD", "90");

    expect(() => loadAwsRekognitionBiometricConfig()).toThrow(AwsRekognitionBiometricConfigurationError);
  });

  it("builds deterministic SigV4 headers and signs the temporary session token", () => {
    const headers = buildAwsRekognitionSigV4Headers({
      config,
      target: "CreateFaceLivenessSession",
      payload: JSON.stringify({ ClientRequestToken: "token" }),
      now: new Date("2026-09-10T12:34:56.000Z"),
    });

    expect(headers.host).toBe("rekognition.eu-west-1.amazonaws.com");
    expect(headers["x-amz-date"]).toBe("20260910T123456Z");
    expect(headers["x-amz-target"]).toBe("RekognitionService.CreateFaceLivenessSession");
    expect(headers["x-amz-security-token"]).toBe("session-token");
    expect(headers.authorization).toContain("Credential=AKIDEXAMPLE/20260910/eu-west-1/rekognition/aws4_request");
    expect(headers.authorization).toContain("x-amz-security-token");
  });

  it("creates a liveness session with audit images disabled and a local expiry safety margin", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      expect(body.ClientRequestToken).toBe("request-token");
      expect(body.Settings).toEqual({ AuditImagesLimit: 0 });
      expect((init?.headers as Record<string, string>)["x-amz-target"]).toBe("RekognitionService.CreateFaceLivenessSession");
      return new Response(JSON.stringify({ SessionId: "12345678-1234-1234-1234-123456789abc" }), { status: 200 });
    });
    const client = new AwsRekognitionBiometricClient(config, fetchImpl as typeof fetch);

    const result = await client.createLivenessSession("request-token");
    expect(result.sessionId).toBe("12345678-1234-1234-1234-123456789abc");
    expect(result.expiresAt.toISOString()).toBe("2026-09-10T12:02:45.000Z");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("normalizes liveness results and never propagates audit images", async () => {
    const bytes = Buffer.from("reference-image").toString("base64");
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      SessionId: "12345678-1234-1234-1234-123456789abc",
      Status: "SUCCEEDED",
      Confidence: 96.25,
      ReferenceImage: { Bytes: bytes, BoundingBox: { Width: 0.5 } },
      Challenge: { Type: "FaceMovementAndLightChallenge", Version: "1.0.0" },
      AuditImages: [{ Bytes: "must-not-be-propagated" }],
    }), { status: 200 }));
    const client = new AwsRekognitionBiometricClient(config, fetchImpl as typeof fetch);

    const result = await client.getLivenessSessionResults("12345678-1234-1234-1234-123456789abc");
    expect(result).toEqual({
      sessionId: "12345678-1234-1234-1234-123456789abc",
      status: "SUCCEEDED",
      confidence: 96.25,
      referenceImageBytes: bytes,
      challengeType: "FaceMovementAndLightChallenge",
      challengeVersion: "1.0.0",
    });
    expect(JSON.stringify(result)).not.toContain("must-not-be-propagated");
  });

  it("marks throttling and server failures as retryable while keeping provider errors typed", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ __type: "ThrottlingException" }), { status: 500 }));
    const client = new AwsRekognitionBiometricClient(config, fetchImpl as typeof fetch);

    try {
      await client.createLivenessSession("request-token");
      throw new Error("expected provider failure");
    } catch (error) {
      expect(error).toBeInstanceOf(AwsRekognitionBiometricError);
      expect((error as AwsRekognitionBiometricError).code).toBe("ThrottlingException");
      expect((error as AwsRekognitionBiometricError).retryable).toBe(true);
    }
  });

  it("rejects oversized reference images before they can be sent back into face search", async () => {
    const oversizedBase64 = "A".repeat(Math.ceil((5 * 1024 * 1024 * 4) / 3) + 16);
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      SessionId: "12345678-1234-1234-1234-123456789abc",
      Status: "SUCCEEDED",
      Confidence: 99,
      ReferenceImage: { Bytes: oversizedBase64 },
    }), { status: 200 }));
    const client = new AwsRekognitionBiometricClient(config, fetchImpl as typeof fetch);

    await expect(client.getLivenessSessionResults("12345678-1234-1234-1234-123456789abc"))
      .rejects.toMatchObject({ code: "REFERENCE_IMAGE_TOO_LARGE" });
  });
});
