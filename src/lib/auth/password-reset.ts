/**
 * Password-reset token generation, verification, and cleanup.
 *
 * Tokens are never stored in plaintext — only the SHA-256 hash is persisted.
 * Each token expires after 1 hour and is single-use.
 */
import crypto from "crypto";
import { db } from "@/lib/db";

const TOKEN_BYTES = 32;
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function generateResetToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(token);

  await db.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
    },
  });

  return token;
}

export async function verifyResetToken(
  token: string,
  userId: string,
): Promise<{ valid: boolean; error?: string; tokenId?: string }> {
  const tokenHash = hashToken(token);

  const record = await db.passwordResetToken.findFirst({
    where: { userId, tokenHash },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return { valid: false, error: "Token not found" };
  }

  if (record.usedAt) {
    return { valid: false, error: "Token already used" };
  }

  if (new Date() > record.expiresAt) {
    return { valid: false, error: "Token expired" };
  }

  return { valid: true, tokenId: record.id };
}

export async function markTokenUsed(tokenId: string): Promise<void> {
  await db.passwordResetToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
}

export async function cleanupExpiredTokens(): Promise<number> {
  const cutoff = new Date(Date.now() - CLEANUP_AGE_MS);

  const { count } = await db.passwordResetToken.deleteMany({
    where: {
      createdAt: { lt: cutoff },
    },
  });

  return count;
}

// ─────────────────────────────────────────────
// Platform user reset tokens
// ─────────────────────────────────────────────

export async function generatePlatformResetToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(token);

  await db.platformPasswordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
    },
  });

  return token;
}

export async function verifyPlatformResetToken(
  token: string,
  userId: string,
): Promise<{ valid: boolean; error?: string; tokenId?: string }> {
  const tokenHash = hashToken(token);

  const record = await db.platformPasswordResetToken.findFirst({
    where: { userId, tokenHash },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return { valid: false, error: "Token not found" };
  }

  if (record.usedAt) {
    return { valid: false, error: "Token already used" };
  }

  if (new Date() > record.expiresAt) {
    return { valid: false, error: "Token expired" };
  }

  return { valid: true, tokenId: record.id };
}

export async function markPlatformTokenUsed(tokenId: string): Promise<void> {
  await db.platformPasswordResetToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
}
