import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;
const DEFAULT_TTL_HOURS = 72;

export function generateInvitationToken() {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return {
    token,
    tokenHash: hashInvitationToken(token),
    expiresAt: new Date(Date.now() + DEFAULT_TTL_HOURS * 60 * 60 * 1000),
  };
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationTokenMatches(token: string, expectedHash: string) {
  const actual = Buffer.from(hashInvitationToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function buildInvitationUrl(token: string) {
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${appUrl}/accept-invite?token=${encodeURIComponent(token)}`;
}
