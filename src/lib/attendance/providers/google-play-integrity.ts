import { createHash } from "node:crypto";
import { SignJWT, importPKCS8 } from "jose";
import type {
  AttendanceVerificationProvider,
  AttendanceVerificationRequest,
  AttendanceVerificationResult,
} from "@/lib/attendance/verification-provider";

const PLAY_INTEGRITY_SCOPE = "https://www.googleapis.com/auth/playintegrity";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const PLAY_INTEGRITY_API_ORIGIN = "https://playintegrity.googleapis.com";
const DEFAULT_MAX_TOKEN_AGE_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_SAFETY_WINDOW_MS = 60 * 1000;

interface GoogleServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface GoogleOAuthTokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

export interface PlayIntegrityPayload {
  requestDetails?: {
    requestPackageName?: string;
    requestHash?: string;
    timestampMillis?: string;
  };
  appIntegrity?: {
    appRecognitionVerdict?: string;
    packageName?: string;
    certificateSha256Digest?: string[];
    versionCode?: string;
  };
  accountDetails?: {
    appLicensingVerdict?: string;
  };
  deviceIntegrity?: {
    deviceRecognitionVerdict?: string[];
  };
}

interface DecodeIntegrityTokenResponse {
  tokenPayloadExternal?: PlayIntegrityPayload;
}

export interface GooglePlayIntegrityConfig {
  packageName: string;
  serviceAccount: GoogleServiceAccountCredentials;
  requireLicensed: boolean;
  requireStrongIntegrity: boolean;
  allowedCertificateDigests: string[];
  maxTokenAgeMs: number;
}

export class GooglePlayIntegrityConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GooglePlayIntegrityConfigurationError";
  }
}

export class GooglePlayIntegrityVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GooglePlayIntegrityVerificationError";
  }
}

let cachedAccessToken: { value: string; expiresAtMs: number } | null = null;

function readBooleanEnv(value: string | undefined, defaultValue: boolean) {
  if (value == null || value.trim() === "") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new GooglePlayIntegrityConfigurationError(`Invalid boolean value: ${value}`);
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (value == null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new GooglePlayIntegrityConfigurationError(`Invalid positive integer value: ${value}`);
  }
  return parsed;
}

export function loadGooglePlayIntegrityConfig(): GooglePlayIntegrityConfig {
  const packageName = (process.env.GOOGLE_PLAY_INTEGRITY_PACKAGE_NAME || "").trim();
  if (!packageName) {
    throw new GooglePlayIntegrityConfigurationError("GOOGLE_PLAY_INTEGRITY_PACKAGE_NAME is required");
  }

  const rawServiceAccount = (process.env.GOOGLE_PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON || "").trim();
  if (!rawServiceAccount) {
    throw new GooglePlayIntegrityConfigurationError("GOOGLE_PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON is required");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawServiceAccount);
  } catch {
    throw new GooglePlayIntegrityConfigurationError("GOOGLE_PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON must be valid JSON");
  }

  const serviceAccount = parsed as Partial<GoogleServiceAccountCredentials>;
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new GooglePlayIntegrityConfigurationError("Google service account JSON must include client_email and private_key");
  }

  const allowedCertificateDigests = (process.env.GOOGLE_PLAY_INTEGRITY_CERT_SHA256 || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    packageName,
    serviceAccount: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key.replace(/\\n/g, "\n"),
      token_uri: serviceAccount.token_uri,
    },
    requireLicensed: readBooleanEnv(process.env.GOOGLE_PLAY_INTEGRITY_REQUIRE_LICENSED, true),
    requireStrongIntegrity: readBooleanEnv(process.env.GOOGLE_PLAY_INTEGRITY_REQUIRE_STRONG, false),
    allowedCertificateDigests,
    maxTokenAgeMs: parsePositiveInteger(
      process.env.GOOGLE_PLAY_INTEGRITY_MAX_TOKEN_AGE_MS,
      DEFAULT_MAX_TOKEN_AGE_MS,
    ),
  };
}

export function playIntegrityRequestHash(challenge: string) {
  return createHash("sha256").update(challenge, "utf8").digest("base64url");
}

function hasAllowedCertificate(payload: PlayIntegrityPayload, allowed: readonly string[]) {
  if (allowed.length === 0) return true;
  const actual = new Set(payload.appIntegrity?.certificateSha256Digest ?? []);
  return allowed.some((digest) => actual.has(digest));
}

export function evaluatePlayIntegrityPayload(
  payload: PlayIntegrityPayload,
  challenge: string,
  config: Pick<
    GooglePlayIntegrityConfig,
    "packageName" | "requireLicensed" | "requireStrongIntegrity" | "allowedCertificateDigests" | "maxTokenAgeMs"
  >,
  nowMs = Date.now(),
) {
  const requestDetails = payload.requestDetails;
  if (!requestDetails) throw new GooglePlayIntegrityVerificationError("Missing requestDetails");

  if (requestDetails.requestPackageName !== config.packageName) {
    throw new GooglePlayIntegrityVerificationError("Integrity token package binding mismatch");
  }

  if (requestDetails.requestHash !== playIntegrityRequestHash(challenge)) {
    throw new GooglePlayIntegrityVerificationError("Integrity token request hash mismatch");
  }

  const timestampMs = Number(requestDetails.timestampMillis);
  if (!Number.isFinite(timestampMs)) {
    throw new GooglePlayIntegrityVerificationError("Integrity token timestamp is invalid");
  }
  const ageMs = nowMs - timestampMs;
  if (ageMs < -60_000 || ageMs > config.maxTokenAgeMs) {
    throw new GooglePlayIntegrityVerificationError("Integrity token timestamp is outside the accepted window");
  }

  const appRecognized = payload.appIntegrity?.appRecognitionVerdict === "PLAY_RECOGNIZED";
  const appPackageMatches = payload.appIntegrity?.packageName === config.packageName;
  const certificateAllowed = hasAllowedCertificate(payload, config.allowedCertificateDigests);
  const licensed = payload.accountDetails?.appLicensingVerdict === "LICENSED";
  const deviceVerdicts = payload.deviceIntegrity?.deviceRecognitionVerdict ?? [];
  const meetsDeviceIntegrity = deviceVerdicts.includes("MEETS_DEVICE_INTEGRITY");
  const meetsStrongIntegrity = deviceVerdicts.includes("MEETS_STRONG_INTEGRITY");

  const deviceTrusted =
    appRecognized &&
    appPackageMatches &&
    certificateAllowed &&
    meetsDeviceIntegrity &&
    (!config.requireLicensed || licensed) &&
    (!config.requireStrongIntegrity || meetsStrongIntegrity);

  return {
    deviceTrusted,
    references: {
      appRecognitionVerdict: payload.appIntegrity?.appRecognitionVerdict ?? "MISSING",
      appLicensingVerdict: payload.accountDetails?.appLicensingVerdict ?? "MISSING",
      deviceRecognitionVerdict: deviceVerdicts.join(",") || "MISSING",
      versionCode: payload.appIntegrity?.versionCode ?? "MISSING",
    },
  };
}

async function createServiceAccountAssertion(config: GooglePlayIntegrityConfig) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(config.serviceAccount.private_key, "RS256");
  return new SignJWT({ scope: PLAY_INTEGRITY_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(config.serviceAccount.client_email)
    .setAudience(config.serviceAccount.token_uri || GOOGLE_OAUTH_TOKEN_URL)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + 3600)
    .sign(key);
}

async function getGoogleAccessToken(config: GooglePlayIntegrityConfig) {
  const nowMs = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAtMs - ACCESS_TOKEN_SAFETY_WINDOW_MS > nowMs) {
    return cachedAccessToken.value;
  }

  const tokenUrl = config.serviceAccount.token_uri || GOOGLE_OAUTH_TOKEN_URL;
  const assertion = await createServiceAccountAssertion(config);
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });

  const body = (await response.json().catch(() => ({}))) as GoogleOAuthTokenResponse;
  if (!response.ok || !body.access_token) {
    throw new GooglePlayIntegrityVerificationError(
      `Google OAuth token exchange failed${body.error ? `: ${body.error}` : ""}`,
    );
  }

  const expiresInSeconds = Number.isFinite(body.expires_in) ? Number(body.expires_in) : 3600;
  cachedAccessToken = {
    value: body.access_token,
    expiresAtMs: nowMs + expiresInSeconds * 1000,
  };
  return body.access_token;
}

async function decodeIntegrityToken(
  integrityToken: string,
  config: GooglePlayIntegrityConfig,
): Promise<PlayIntegrityPayload> {
  const accessToken = await getGoogleAccessToken(config);
  const url = `${PLAY_INTEGRITY_API_ORIGIN}/v1/${encodeURIComponent(config.packageName)}:decodeIntegrityToken`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ integrity_token: integrityToken }),
    cache: "no-store",
  });

  const body = (await response.json().catch(() => ({}))) as DecodeIntegrityTokenResponse & {
    error?: { message?: string };
  };
  if (!response.ok || !body.tokenPayloadExternal) {
    throw new GooglePlayIntegrityVerificationError(
      `Play Integrity decode failed${body.error?.message ? `: ${body.error.message}` : ""}`,
    );
  }
  return body.tokenPayloadExternal;
}

export function createGooglePlayIntegrityProvider(): AttendanceVerificationProvider {
  const config = loadGooglePlayIntegrityConfig();

  return {
    key: "google_play_integrity",
    capabilities: ["DEVICE_INTEGRITY"],
    async verify(request: AttendanceVerificationRequest): Promise<AttendanceVerificationResult> {
      const integrityToken = request.evidence.deviceIntegrityToken;
      if (!integrityToken) {
        throw new GooglePlayIntegrityVerificationError("deviceIntegrityToken is required");
      }

      const payload = await decodeIntegrityToken(integrityToken, config);
      const evaluation = evaluatePlayIntegrityPayload(payload, request.challenge, config);
      return {
        provider: "google_play_integrity",
        verifiedAt: new Date().toISOString(),
        deviceTrusted: evaluation.deviceTrusted,
        mockLocationRisk: null,
        faceMatchScore: null,
        livenessPassed: null,
        references: evaluation.references,
      };
    },
  };
}
