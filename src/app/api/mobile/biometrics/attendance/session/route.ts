import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileEmployee } from "@/lib/auth/mobile";
import {
  AttendanceVerificationProviderConfigurationError,
  getAttendanceVerificationProvider,
} from "@/lib/attendance/verification-provider";
import {
  AttendanceVerificationChallengeError,
  validateAttendanceVerificationChallenge,
} from "@/lib/attendance/verification-challenge";
import {
  BiometricIdentityError,
  createAttendanceLivenessSession,
} from "@/lib/attendance/biometric-identity";

const BodySchema = z.object({
  challengeId: z.string().min(8).max(128),
  challenge: z.string().min(20).max(512),
}).strict();

function biometricError(error: BiometricIdentityError) {
  if (error.code === "BIOMETRIC_ENROLLMENT_REQUIRED") {
    return NextResponse.json({ error: error.code }, { status: 409 });
  }
  if (error.code === "BIOMETRIC_RECONSENT_REQUIRED") {
    return NextResponse.json({ error: error.code }, { status: 428 });
  }
  if (error.code === "BIOMETRIC_NEW_CHALLENGE_REQUIRED") {
    return NextResponse.json({ error: error.code }, { status: 409 });
  }
  if (error.code === "BIOMETRIC_SESSION_ALREADY_USED") {
    return NextResponse.json({ error: error.code }, { status: 409 });
  }
  if (error.code.startsWith("BIOMETRIC_CONSENT_CONFIG_") || error.code.startsWith("BIOMETRIC_PROVIDER_")) {
    return NextResponse.json({ error: error.code }, { status: 503 });
  }
  return NextResponse.json({ error: "BIOMETRIC_SESSION_FAILED" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const context = await requireMobileEmployee(request);
  if (!context) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  let provider;
  try {
    provider = getAttendanceVerificationProvider();
  } catch (error) {
    if (error instanceof AttendanceVerificationProviderConfigurationError) {
      return NextResponse.json({ error: "VERIFICATION_PROVIDER_MISCONFIGURED" }, { status: 503 });
    }
    throw error;
  }
  if (!provider.capabilities.includes("FACE_MATCH") || !provider.capabilities.includes("LIVENESS")) {
    return NextResponse.json({ error: "BIOMETRIC_PROVIDER_UNAVAILABLE" }, { status: 503 });
  }

  try {
    await validateAttendanceVerificationChallenge({
      id: parsed.data.challengeId,
      challenge: parsed.data.challenge,
      companyId: context.employee.companyId,
      employeeId: context.employee.id,
      userId: context.user.id,
      providerKey: provider.key,
    });
  } catch (error) {
    if (error instanceof AttendanceVerificationChallengeError) {
      const status = error.code === "CHALLENGE_EXPIRED" ? 410 : error.code === "CHALLENGE_ALREADY_USED" ? 409 : 400;
      return NextResponse.json({ error: `VERIFICATION_${error.code}` }, { status });
    }
    throw error;
  }

  try {
    const session = await createAttendanceLivenessSession({
      companyId: context.employee.companyId,
      employeeId: context.employee.id,
      userId: context.user.id,
      attendanceChallengeId: parsed.data.challengeId,
    });
    return NextResponse.json({
      session: {
        id: session.id,
        providerSessionId: session.providerSessionId,
        provider: session.provider,
        region: session.region,
        expiresAt: session.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof BiometricIdentityError) return biometricError(error);
    throw error;
  }
}
