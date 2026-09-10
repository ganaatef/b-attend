import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { AttendanceVerificationCapability } from "@/lib/attendance/verification-provider";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type AttendanceVerificationChallengeErrorCode =
  | "CHALLENGE_NOT_FOUND"
  | "CHALLENGE_EXPIRED"
  | "CHALLENGE_ALREADY_USED"
  | "CHALLENGE_INVALID"
  | "CHALLENGE_PROVIDER_MISMATCH";

export class AttendanceVerificationChallengeError extends Error {
  constructor(readonly code: AttendanceVerificationChallengeErrorCode) {
    super(code);
    this.name = "AttendanceVerificationChallengeError";
  }
}

export function hashAttendanceVerificationChallenge(challenge: string): string {
  return createHash("sha256").update(challenge, "utf8").digest("hex");
}

export async function issueAttendanceVerificationChallenge(input: {
  companyId: string;
  employeeId: string;
  userId: string;
  providerKey: string;
  capabilities: readonly AttendanceVerificationCapability[];
}) {
  const challenge = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  const row = await db.attendanceVerificationChallenge.create({
    data: {
      companyId: input.companyId,
      employeeId: input.employeeId,
      userId: input.userId,
      nonceHash: hashAttendanceVerificationChallenge(challenge),
      providerKey: input.providerKey,
      requestedCapabilities: JSON.stringify([...input.capabilities].sort()),
      expiresAt,
    },
    select: { id: true, expiresAt: true },
  });
  return { id: row.id, challenge, expiresAt: row.expiresAt };
}

export async function validateAttendanceVerificationChallenge(input: {
  id: string;
  challenge: string;
  companyId: string;
  employeeId: string;
  userId: string;
  providerKey: string;
}) {
  const row = await db.attendanceVerificationChallenge.findFirst({
    where: {
      id: input.id,
      companyId: input.companyId,
      employeeId: input.employeeId,
      userId: input.userId,
    },
  });
  if (!row) throw new AttendanceVerificationChallengeError("CHALLENGE_NOT_FOUND");
  if (row.consumedAt) throw new AttendanceVerificationChallengeError("CHALLENGE_ALREADY_USED");
  if (row.expiresAt <= new Date()) throw new AttendanceVerificationChallengeError("CHALLENGE_EXPIRED");
  if (row.providerKey !== input.providerKey) throw new AttendanceVerificationChallengeError("CHALLENGE_PROVIDER_MISMATCH");
  if (row.nonceHash !== hashAttendanceVerificationChallenge(input.challenge)) {
    throw new AttendanceVerificationChallengeError("CHALLENGE_INVALID");
  }
  return row;
}

/**
 * Consume inside the same DB transaction that creates the punch. updateMany is
 * deliberately used as a compare-and-set so concurrent replays cannot both win.
 */
export async function consumeAttendanceVerificationChallenge(
  tx: Pick<Prisma.TransactionClient, "attendanceVerificationChallenge">,
  input: { id: string; companyId: string; employeeId: string; userId: string },
) {
  const now = new Date();
  const result = await tx.attendanceVerificationChallenge.updateMany({
    where: {
      id: input.id,
      companyId: input.companyId,
      employeeId: input.employeeId,
      userId: input.userId,
      consumedAt: null,
      expiresAt: { gt: now },
    },
    data: { consumedAt: now },
  });
  if (result.count !== 1) throw new AttendanceVerificationChallengeError("CHALLENGE_ALREADY_USED");
  return now;
}

export const ATTENDANCE_VERIFICATION_CHALLENGE_TTL_SECONDS = CHALLENGE_TTL_MS / 1000;
