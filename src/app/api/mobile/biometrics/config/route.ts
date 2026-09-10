import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireMobileEmployee } from "@/lib/auth/mobile";
import { attendanceTrustPolicyFromSettings } from "@/lib/attendance/trust-policy";
import {
  BiometricIdentityError,
  configuredBiometricCapabilities,
  configuredBiometricProviderKey,
  currentBiometricConsentVersion,
} from "@/lib/attendance/biometric-identity";

export async function GET(request: NextRequest) {
  const context = await requireMobileEmployee(request);
  if (!context) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const [settings, enrollment] = await Promise.all([
      db.companySettings.findUnique({ where: { companyId: context.employee.companyId } }),
      db.biometricEnrollment.findFirst({
        where: { companyId: context.employee.companyId, employeeId: context.employee.id },
        select: {
          status: true,
          consentVersion: true,
          consentedAt: true,
          enrolledAt: true,
          lastVerifiedAt: true,
        },
      }),
    ]);

    const policy = attendanceTrustPolicyFromSettings(settings);
    const provider = configuredBiometricProviderKey();
    const capabilities = configuredBiometricCapabilities();
    const biometricsRequired = policy.requireFace || policy.requireLiveness;
    const consentVersion = provider === "none" ? null : currentBiometricConsentVersion();
    const consentCurrent = Boolean(
      enrollment?.consentedAt && consentVersion && enrollment.consentVersion === consentVersion,
    );

    return NextResponse.json({
      provider,
      capabilities,
      required: {
        faceMatch: policy.requireFace,
        liveness: policy.requireLiveness,
        biometrics: biometricsRequired,
      },
      consent: {
        version: consentVersion,
        current: consentCurrent,
      },
      enrollment: enrollment
        ? {
            status: enrollment.status,
            enrolledAt: enrollment.enrolledAt?.toISOString() ?? null,
            lastVerifiedAt: enrollment.lastVerifiedAt?.toISOString() ?? null,
            reconsentRequired: enrollment.status === "ACTIVE" && !consentCurrent,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof BiometricIdentityError) {
      return NextResponse.json({ error: error.code }, { status: 503 });
    }
    throw error;
  }
}
