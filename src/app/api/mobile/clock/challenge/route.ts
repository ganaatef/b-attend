import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireMobileEmployee } from "@/lib/auth/mobile";
import { attendanceTrustPolicyFromSettings } from "@/lib/attendance/trust-policy";
import {
  getAttendanceVerificationProvider,
  missingAttendanceVerificationCapabilities,
  requiredAttendanceVerificationCapabilities,
  AttendanceVerificationProviderConfigurationError,
} from "@/lib/attendance/verification-provider";
import {
  issueAttendanceVerificationChallenge,
  ATTENDANCE_VERIFICATION_CHALLENGE_TTL_SECONDS,
} from "@/lib/attendance/verification-challenge";

export async function POST(request: NextRequest) {
  const context = await requireMobileEmployee(request);
  if (!context) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const settings = await db.companySettings.findUnique({
    where: { companyId: context.employee.companyId },
  });
  const policy = attendanceTrustPolicyFromSettings(settings);

  let provider;
  try {
    provider = getAttendanceVerificationProvider();
  } catch (error) {
    if (error instanceof AttendanceVerificationProviderConfigurationError) {
      return NextResponse.json({ error: "VERIFICATION_PROVIDER_MISCONFIGURED" }, { status: 503 });
    }
    throw error;
  }

  const required = requiredAttendanceVerificationCapabilities(policy, "MOBILE_APP");
  const missing = missingAttendanceVerificationCapabilities(provider, required);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "VERIFICATION_PROVIDER_UNAVAILABLE", missingCapabilities: missing },
      { status: 503 },
    );
  }

  // With no verification provider connected there is nothing for the client to
  // prove. We avoid generating useless DB rows while still returning an explicit
  // capability contract to the app.
  if (provider.capabilities.length === 0) {
    return NextResponse.json({
      verificationRequired: required.length > 0,
      provider: provider.key,
      capabilities: [],
      challenge: null,
      ttlSeconds: ATTENDANCE_VERIFICATION_CHALLENGE_TTL_SECONDS,
    });
  }

  const issued = await issueAttendanceVerificationChallenge({
    companyId: context.employee.companyId,
    employeeId: context.employee.id,
    userId: context.user.id,
    providerKey: provider.key,
    capabilities: provider.capabilities,
  });

  return NextResponse.json({
    verificationRequired: required.length > 0,
    provider: provider.key,
    capabilities: provider.capabilities,
    challenge: {
      id: issued.id,
      value: issued.challenge,
      expiresAt: issued.expiresAt.toISOString(),
    },
    ttlSeconds: ATTENDANCE_VERIFICATION_CHALLENGE_TTL_SECONDS,
  });
}
