import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireMobileEmployee } from "@/lib/auth/mobile";
import {
  BiometricIdentityError,
  completeEnrollmentLiveness,
} from "@/lib/attendance/biometric-identity";

const BodySchema = z.object({ sessionId: z.string().min(8).max(128) }).strict();

function errorResponse(error: BiometricIdentityError) {
  const conflict = new Set([
    "BIOMETRIC_SESSION_ALREADY_USED",
    "BIOMETRIC_ENROLLMENT_STATE_CHANGED",
    "DUPLICATE_BIOMETRIC_IDENTITY",
  ]);
  if (conflict.has(error.code)) return NextResponse.json({ error: error.code }, { status: 409 });
  if (error.code === "BIOMETRIC_SESSION_EXPIRED") return NextResponse.json({ error: error.code }, { status: 410 });
  if (error.code === "BIOMETRIC_SESSION_PROCESSING") return NextResponse.json({ error: error.code }, { status: 425 });
  if (error.code === "BIOMETRIC_CONSENT_REQUIRED") return NextResponse.json({ error: error.code }, { status: 422 });
  if (error.code.startsWith("BIOMETRIC_PROVIDER_")) return NextResponse.json({ error: error.code }, { status: 503 });
  if (error.code === "BIOMETRIC_LIVENESS_FAILED") return NextResponse.json({ error: error.code }, { status: 422 });
  return NextResponse.json({ error: "BIOMETRIC_ENROLLMENT_FAILED" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const context = await requireMobileEmployee(request);
  if (!context) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  try {
    const result = await completeEnrollmentLiveness({
      companyId: context.employee.companyId,
      employeeId: context.employee.id,
      userId: context.user.id,
      sessionId: parsed.data.sessionId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BiometricIdentityError) return errorResponse(error);
    throw error;
  }
}
