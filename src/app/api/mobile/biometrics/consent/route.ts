import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileEmployee } from "@/lib/auth/mobile";
import {
  acceptBiometricConsent,
  BiometricIdentityError,
} from "@/lib/attendance/biometric-identity";

const BodySchema = z.object({
  consentVersion: z.string().trim().min(1).max(80),
}).strict();

function errorResponse(error: BiometricIdentityError) {
  if (error.code === "BIOMETRIC_CONSENT_OUTDATED") {
    return NextResponse.json({ error: error.code }, { status: 409 });
  }
  if (error.code === "BIOMETRIC_CONSENT_REQUIRED") {
    return NextResponse.json({ error: error.code }, { status: 422 });
  }
  if (error.code === "BIOMETRIC_ENROLLMENT_REQUIRED") {
    return NextResponse.json({ error: error.code }, { status: 409 });
  }
  if (error.code.startsWith("BIOMETRIC_CONSENT_CONFIG_")) {
    return NextResponse.json({ error: error.code }, { status: 503 });
  }
  return NextResponse.json({ error: "BIOMETRIC_CONSENT_FAILED" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const context = await requireMobileEmployee(request);
  if (!context) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  try {
    const result = await acceptBiometricConsent({
      companyId: context.employee.companyId,
      employeeId: context.employee.id,
      userId: context.user.id,
      consentVersion: parsed.data.consentVersion,
    });
    return NextResponse.json({
      ok: true,
      consentVersion: result.consentVersion,
      consentedAt: result.consentedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof BiometricIdentityError) return errorResponse(error);
    throw error;
  }
}
