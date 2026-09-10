import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileEmployee } from "@/lib/auth/mobile";
import {
  BiometricIdentityError,
  createEnrollmentLivenessSession,
} from "@/lib/attendance/biometric-identity";

const BodySchema = z.object({
  consentVersion: z.string().trim().min(1).max(80),
}).strict();

function errorResponse(error: BiometricIdentityError) {
  switch (error.code) {
    case "BIOMETRIC_CONSENT_REQUIRED":
      return NextResponse.json({ error: error.code }, { status: 422 });
    case "BIOMETRIC_CONSENT_OUTDATED":
      return NextResponse.json({ error: error.code }, { status: 409 });
    case "BIOMETRIC_ENROLLMENT_NOT_REQUESTED":
      return NextResponse.json({ error: error.code }, { status: 409 });
    case "BIOMETRIC_CONSENT_CONFIG_MISSING":
    case "BIOMETRIC_CONSENT_CONFIG_INVALID":
    case "BIOMETRIC_PROVIDER_UNAVAILABLE":
    case "BIOMETRIC_PROVIDER_MISCONFIGURED":
    case "BIOMETRIC_PROVIDER_FAILED":
    case "BIOMETRIC_PROVIDER_RETRYABLE":
      return NextResponse.json({ error: error.code }, { status: 503 });
    default:
      return NextResponse.json({ error: "BIOMETRIC_ENROLLMENT_FAILED" }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const context = await requireMobileEmployee(request);
  if (!context) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  try {
    const session = await createEnrollmentLivenessSession({
      companyId: context.employee.companyId,
      employeeId: context.employee.id,
      userId: context.user.id,
      consentVersion: parsed.data.consentVersion,
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
    if (error instanceof BiometricIdentityError) return errorResponse(error);
    throw error;
  }
}
