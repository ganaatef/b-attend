import { createHash, createHmac } from "node:crypto";

const SERVICE = "rekognition";
const DEFAULT_LIVENESS_THRESHOLD = 90;
const DEFAULT_FACE_MATCH_THRESHOLD = 90;
const DEFAULT_DUPLICATE_THRESHOLD = 97;
const MAX_REFERENCE_IMAGE_BYTES = 5 * 1024 * 1024;

export class AwsRekognitionBiometricConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AwsRekognitionBiometricConfigurationError";
  }
}

export class AwsRekognitionBiometricError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message = "AWS Rekognition biometric verification failed", retryable = false) {
    super(message);
    this.name = "AwsRekognitionBiometricError";
    this.code = code;
    this.retryable = retryable;
  }
}

export interface AwsRekognitionBiometricConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  collectionId: string;
  kmsKeyId?: string;
  livenessThreshold: number;
  faceMatchThreshold: number;
  duplicateThreshold: number;
}

export interface LivenessSessionResult {
  sessionId: string;
  status: "CREATED" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "EXPIRED";
  confidence: number | null;
  referenceImageBytes: string | null;
  challengeType: string | null;
  challengeVersion: string | null;
}

export interface FaceSearchMatch {
  faceId: string;
  externalImageId: string | null;
  similarity: number;
}

interface AwsJsonRpcArgs {
  target: string;
  body: Record<string, unknown>;
  now?: Date;
  fetchImpl?: typeof fetch;
}

interface AwsErrorPayload {
  __type?: string;
  Code?: string;
  code?: string;
  Message?: string;
  message?: string;
}

interface RekognitionFace {
  FaceId?: string;
  ExternalImageId?: string;
}

interface RekognitionFaceMatch {
  Similarity?: number;
  Face?: RekognitionFace;
}

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

function requiredEnv(name: string): string {
  const value = env(name);
  if (!value) throw new AwsRekognitionBiometricConfigurationError(`${name} is required`);
  return value;
}

function numericEnv(name: string, fallback: number, min = 0, max = 100): number {
  const raw = env(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new AwsRekognitionBiometricConfigurationError(`${name} must be between ${min} and ${max}`);
  }
  return value;
}

export function loadAwsRekognitionBiometricConfig(): AwsRekognitionBiometricConfig {
  const livenessThreshold = numericEnv("AWS_REKOGNITION_LIVENESS_THRESHOLD", DEFAULT_LIVENESS_THRESHOLD);
  const faceMatchThreshold = numericEnv("AWS_REKOGNITION_FACE_MATCH_THRESHOLD", DEFAULT_FACE_MATCH_THRESHOLD);
  const duplicateThreshold = numericEnv("AWS_REKOGNITION_DUPLICATE_THRESHOLD", DEFAULT_DUPLICATE_THRESHOLD);
  if (duplicateThreshold < faceMatchThreshold) {
    throw new AwsRekognitionBiometricConfigurationError(
      "AWS_REKOGNITION_DUPLICATE_THRESHOLD must be greater than or equal to AWS_REKOGNITION_FACE_MATCH_THRESHOLD",
    );
  }

  return {
    region: requiredEnv("AWS_REKOGNITION_REGION"),
    accessKeyId: requiredEnv("AWS_REKOGNITION_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("AWS_REKOGNITION_SECRET_ACCESS_KEY"),
    sessionToken: env("AWS_REKOGNITION_SESSION_TOKEN") || undefined,
    collectionId: requiredEnv("AWS_REKOGNITION_COLLECTION_ID"),
    kmsKeyId: env("AWS_REKOGNITION_KMS_KEY_ID") || undefined,
    livenessThreshold,
    faceMatchThreshold,
    duplicateThreshold,
  };
}

function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function formatAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

export function biometricExternalSubject(companyId: string, employeeId: string): string {
  const digest = sha256Hex(`${companyId}:${employeeId}`);
  return `ba_${digest.slice(0, 48)}`;
}

export function buildAwsRekognitionSigV4Headers(args: {
  config: AwsRekognitionBiometricConfig;
  target: string;
  payload: string;
  now?: Date;
}): Record<string, string> {
  const now = args.now ?? new Date();
  const { amzDate, dateStamp } = formatAmzDate(now);
  const host = `${SERVICE}.${args.config.region}.amazonaws.com`;

  const headers: Record<string, string> = {
    "content-type": "application/x-amz-json-1.1",
    host,
    "x-amz-date": amzDate,
    "x-amz-target": `RekognitionService.${args.target}`,
  };
  if (args.config.sessionToken) headers["x-amz-security-token"] = args.config.sessionToken;

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers[name]!.trim()}\n`).join("");
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    sha256Hex(args.payload),
  ].join("\n");

  const credentialScope = `${dateStamp}/${args.config.region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const dateKey = hmac(`AWS4${args.config.secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, args.config.region);
  const serviceKey = hmac(regionKey, SERVICE);
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return {
    ...headers,
    authorization:
      `AWS4-HMAC-SHA256 Credential=${args.config.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function awsErrorCode(payload: AwsErrorPayload | null, status: number): string {
  const raw = payload?.__type ?? payload?.Code ?? payload?.code ?? `HTTP_${status}`;
  return String(raw).split("#").pop()?.split(":")[0] || `HTTP_${status}`;
}

function isRetryableAwsError(code: string, status: number): boolean {
  return status >= 500 || ["ThrottlingException", "ProvisionedThroughputExceededException"].includes(code);
}

function validateReferenceImage(bytes: unknown): string | null {
  if (typeof bytes !== "string" || bytes.length === 0) return null;
  const approxBytes = Math.floor((bytes.length * 3) / 4);
  if (approxBytes > MAX_REFERENCE_IMAGE_BYTES) {
    throw new AwsRekognitionBiometricError("REFERENCE_IMAGE_TOO_LARGE");
  }
  return bytes;
}

export class AwsRekognitionBiometricClient {
  readonly config: AwsRekognitionBiometricConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config = loadAwsRekognitionBiometricConfig(), fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
  }

  private async rpc<T>({ target, body, now, fetchImpl }: AwsJsonRpcArgs): Promise<T> {
    const payload = JSON.stringify(body);
    const headers = buildAwsRekognitionSigV4Headers({ config: this.config, target, payload, now });
    const response = await (fetchImpl ?? this.fetchImpl)(
      `https://${SERVICE}.${this.config.region}.amazonaws.com/`,
      { method: "POST", headers, body: payload, cache: "no-store" },
    );

    let parsed: T | AwsErrorPayload | null = null;
    try {
      parsed = (await response.json()) as T | AwsErrorPayload;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const code = awsErrorCode(parsed as AwsErrorPayload | null, response.status);
      throw new AwsRekognitionBiometricError(code, "AWS Rekognition request failed", isRetryableAwsError(code, response.status));
    }
    if (!parsed) throw new AwsRekognitionBiometricError("INVALID_PROVIDER_RESPONSE");
    return parsed as T;
  }

  async createLivenessSession(clientRequestToken: string): Promise<{ sessionId: string; expiresAt: Date }> {
    if (!/^[a-zA-Z0-9-_]{1,64}$/.test(clientRequestToken)) {
      throw new AwsRekognitionBiometricError("INVALID_CLIENT_REQUEST_TOKEN");
    }
    const body: Record<string, unknown> = {
      ClientRequestToken: clientRequestToken,
      Settings: { AuditImagesLimit: 0 },
    };
    if (this.config.kmsKeyId) body.KmsKeyId = this.config.kmsKeyId;

    const result = await this.rpc<{ SessionId?: string }>({
      target: "CreateFaceLivenessSession",
      body,
    });
    if (!result.SessionId || !/^[0-9a-f-]{36}$/.test(result.SessionId)) {
      throw new AwsRekognitionBiometricError("INVALID_PROVIDER_RESPONSE");
    }
    // AWS liveness SessionId expires after three minutes. Keep a safety margin.
    return { sessionId: result.SessionId, expiresAt: new Date(Date.now() + 165_000) };
  }

  async getLivenessSessionResults(sessionId: string): Promise<LivenessSessionResult> {
    const result = await this.rpc<{
      SessionId?: string;
      Status?: LivenessSessionResult["status"];
      Confidence?: number;
      ReferenceImage?: { Bytes?: string };
      Challenge?: { Type?: string; Version?: string };
    }>({
      target: "GetFaceLivenessSessionResults",
      body: { SessionId: sessionId },
    });

    if (result.SessionId !== sessionId || !result.Status) {
      throw new AwsRekognitionBiometricError("INVALID_PROVIDER_RESPONSE");
    }
    const confidence = typeof result.Confidence === "number" && Number.isFinite(result.Confidence)
      ? Math.max(0, Math.min(100, result.Confidence))
      : null;

    return {
      sessionId,
      status: result.Status,
      confidence,
      referenceImageBytes: validateReferenceImage(result.ReferenceImage?.Bytes),
      challengeType: result.Challenge?.Type ?? null,
      challengeVersion: result.Challenge?.Version ?? null,
    };
  }

  async searchFacesByImage(imageBytes: string, threshold = this.config.faceMatchThreshold): Promise<FaceSearchMatch[]> {
    const image = validateReferenceImage(imageBytes);
    if (!image) throw new AwsRekognitionBiometricError("REFERENCE_IMAGE_MISSING");
    const result = await this.rpc<{ FaceMatches?: RekognitionFaceMatch[] }>({
      target: "SearchFacesByImage",
      body: {
        CollectionId: this.config.collectionId,
        FaceMatchThreshold: threshold,
        MaxFaces: 20,
        QualityFilter: "HIGH",
        Image: { Bytes: image },
      },
    });

    return (result.FaceMatches ?? []).flatMap((match) => {
      const faceId = match.Face?.FaceId;
      const similarity = match.Similarity;
      if (!faceId || typeof similarity !== "number" || !Number.isFinite(similarity)) return [];
      return [{
        faceId,
        externalImageId: match.Face?.ExternalImageId ?? null,
        similarity: Math.max(0, Math.min(100, similarity)),
      }];
    });
  }

  async indexFace(imageBytes: string, externalImageId: string): Promise<string> {
    const image = validateReferenceImage(imageBytes);
    if (!image) throw new AwsRekognitionBiometricError("REFERENCE_IMAGE_MISSING");
    if (!/^[A-Za-z0-9_.:-]{1,255}$/.test(externalImageId)) {
      throw new AwsRekognitionBiometricError("INVALID_EXTERNAL_SUBJECT");
    }

    const result = await this.rpc<{ FaceRecords?: Array<{ Face?: RekognitionFace }> }>({
      target: "IndexFaces",
      body: {
        CollectionId: this.config.collectionId,
        ExternalImageId: externalImageId,
        MaxFaces: 1,
        QualityFilter: "HIGH",
        Image: { Bytes: image },
      },
    });
    const faceId = result.FaceRecords?.[0]?.Face?.FaceId;
    if (!faceId) throw new AwsRekognitionBiometricError("FACE_NOT_INDEXED");
    return faceId;
  }

  async deleteFace(faceId: string): Promise<void> {
    if (!faceId) return;
    const result = await this.rpc<{ DeletedFaces?: string[] }>({
      target: "DeleteFaces",
      body: { CollectionId: this.config.collectionId, FaceIds: [faceId] },
    });
    if (!(result.DeletedFaces ?? []).includes(faceId)) {
      throw new AwsRekognitionBiometricError("FACE_NOT_DELETED");
    }
  }

  livenessPassed(confidence: number | null): boolean {
    return confidence != null && confidence >= this.config.livenessThreshold;
  }
}
