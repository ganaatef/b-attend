import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

const script = path.resolve(process.cwd(), "scripts/preflight-production.mjs");

function validBaseEnv() {
  return {
    ...process.env,
    DATABASE_URL: "postgresql://user:pass@db.example.test:5432/battend?sslmode=require",
    DIRECT_URL: "postgresql://user:pass@db.example.test:5432/battend?sslmode=require",
    APP_URL: "https://app.example.test",
    SESSION_SECRET: "production-test-secret-that-is-at-least-32-characters",
    UPSTASH_REDIS_REST_URL: "https://redis.example.test",
    UPSTASH_REDIS_REST_TOKEN: "redis-test-token",
    EMAIL_PROVIDER: "resend",
    EMAIL_FROM: "B-Attend <no-reply@example.test>",
    RESEND_API_KEY: "re_test_key_not_real",
    DB_CONNECTION_LIMIT: "10",
    DB_POOL_TIMEOUT_SEC: "10",
    RUN_PRISMA_MIGRATIONS: "true",
    NEXT_PUBLIC_DEMO_MODE: "false",
    DEMO_SEED_CONFIRM: "false",
    PAYMENT_WEBHOOK_SECRET: "",
    PAYMOB_API_KEY: "",
    PAYMOB_INTEGRATION_ID: "",
    PAYMOB_HMAC_SECRET: "",
    ATTENDANCE_VERIFICATION_PROVIDER: "none",
    ATTENDANCE_BIOMETRIC_PROVIDER: "none",
  };
}

function validAwsBiometricEnv() {
  return {
    ATTENDANCE_BIOMETRIC_PROVIDER: "aws_rekognition",
    AWS_REKOGNITION_REGION: "eu-west-1",
    AWS_REKOGNITION_ACCESS_KEY_ID: "access-key-at-least-16",
    AWS_REKOGNITION_SECRET_ACCESS_KEY: "secret-key-that-is-at-least-32-characters",
    AWS_REKOGNITION_COLLECTION_ID: "b-attend-test",
    AWS_REKOGNITION_LIVENESS_THRESHOLD: "90",
    AWS_REKOGNITION_FACE_MATCH_THRESHOLD: "90",
    AWS_REKOGNITION_DUPLICATE_THRESHOLD: "97",
    BIOMETRIC_CONSENT_VERSION: "2026-09-10-v1",
  };
}

function run(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [script], { env, encoding: "utf8" });
}

describe("production preflight", () => {
  it("allows explicit sales-assisted manual billing", () => {
    const result = run({
      ...validBaseEnv(),
      BILLING_MODE: "sales_assisted",
      PAYMENT_PROVIDER: "manual",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS: required production configuration is present");
    expect(result.stderr).toContain("public card checkout is disabled");
  });

  it("blocks self-service mode when payment provider is still manual", () => {
    const result = run({
      ...validBaseEnv(),
      BILLING_MODE: "self_service",
      PAYMENT_PROVIDER: "manual",
    });

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain("requires PAYMENT_PROVIDER='paymob'");
  });

  it("blocks incomplete Paymob self-service credentials", () => {
    const result = run({
      ...validBaseEnv(),
      BILLING_MODE: "self_service",
      PAYMENT_PROVIDER: "paymob",
      PAYMENT_WEBHOOK_SECRET: "short",
      PAYMOB_API_KEY: "short",
      PAYMOB_INTEGRATION_ID: "not-a-number",
      PAYMOB_HMAC_SECRET: "short",
    });

    expect(result.status).toBe(1);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(output).toContain("PAYMENT_WEBHOOK_SECRET is missing or invalid");
    expect(output).toContain("PAYMOB_API_KEY is missing or invalid");
    expect(output).toContain("PAYMOB_INTEGRATION_ID is missing or invalid");
    expect(output).toContain("PAYMOB_HMAC_SECRET is missing or invalid");
  });

  it("allows fully configured Paymob self-service mode", () => {
    const result = run({
      ...validBaseEnv(),
      BILLING_MODE: "self_service",
      PAYMENT_PROVIDER: "paymob",
      PAYMENT_WEBHOOK_SECRET: "webhook-secret-at-least-24-characters",
      PAYMOB_API_KEY: "paymob-api-key-at-least-16",
      PAYMOB_INTEGRATION_ID: "123456",
      PAYMOB_HMAC_SECRET: "paymob-hmac-secret-at-least-24-characters",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PASS: required production configuration is present");
  });

  it("allows a complete AWS Face Liveness production contract in a supported region", () => {
    const result = run({
      ...validBaseEnv(),
      BILLING_MODE: "sales_assisted",
      PAYMENT_PROVIDER: "manual",
      ...validAwsBiometricEnv(),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Biometric provider: aws_rekognition");
  });

  it("blocks an AWS region without Face Liveness streaming support", () => {
    const result = run({
      ...validBaseEnv(),
      BILLING_MODE: "sales_assisted",
      PAYMENT_PROVIDER: "manual",
      ...validAwsBiometricEnv(),
      AWS_REKOGNITION_REGION: "me-south-1",
    });

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain("AWS_REKOGNITION_REGION is missing or invalid");
  });

  it("blocks biometric production mode without a pinned consent policy version", () => {
    const result = run({
      ...validBaseEnv(),
      BILLING_MODE: "sales_assisted",
      PAYMENT_PROVIDER: "manual",
      ...validAwsBiometricEnv(),
      BIOMETRIC_CONSENT_VERSION: "",
    });

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain("BIOMETRIC_CONSENT_VERSION is missing or invalid");
  });
});
