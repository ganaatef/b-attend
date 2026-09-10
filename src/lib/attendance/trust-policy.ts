import type { CompanySettings } from "@prisma/client";
import {
  DEFAULT_ATTENDANCE_TRUST_POLICY,
  type AttendanceTrustPolicy,
} from "@/lib/attendance/trust-engine";

type TrustPolicySettings = Pick<
  CompanySettings,
  | "trustPolicyVersion"
  | "trustReviewBelow"
  | "trustRejectBelow"
  | "trustBlockCriticalRisk"
  | "trustRequireFace"
  | "trustRequireLiveness"
>;

function boundedInt(value: number | null | undefined, fallback: number, min: number, max: number) {
  if (!Number.isInteger(value)) return fallback;
  return Math.max(min, Math.min(max, value as number));
}

export function attendanceTrustPolicyFromSettings(
  settings: TrustPolicySettings | null | undefined,
): AttendanceTrustPolicy {
  const reviewBelow = boundedInt(settings?.trustReviewBelow, DEFAULT_ATTENDANCE_TRUST_POLICY.reviewBelow, 1, 100);
  const rejectBelow = Math.min(
    reviewBelow - 1,
    boundedInt(settings?.trustRejectBelow, DEFAULT_ATTENDANCE_TRUST_POLICY.rejectBelow, 0, 99),
  );
  const configuredVersion = settings?.trustPolicyVersion?.trim() || "tenant-trust-v1";
  const fingerprint = [
    configuredVersion,
    `review-${reviewBelow}`,
    `reject-${rejectBelow}`,
    `critical-${settings?.trustBlockCriticalRisk ? 1 : 0}`,
    `face-${settings?.trustRequireFace ? 1 : 0}`,
    `live-${settings?.trustRequireLiveness ? 1 : 0}`,
  ].join(":");

  return {
    version: `${DEFAULT_ATTENDANCE_TRUST_POLICY.version}:${fingerprint}`,
    reviewBelow,
    rejectBelow,
    blockCriticalRisk: settings?.trustBlockCriticalRisk ?? DEFAULT_ATTENDANCE_TRUST_POLICY.blockCriticalRisk,
    requireFace: settings?.trustRequireFace ?? DEFAULT_ATTENDANCE_TRUST_POLICY.requireFace,
    requireLiveness: settings?.trustRequireLiveness ?? DEFAULT_ATTENDANCE_TRUST_POLICY.requireLiveness,
  };
}
