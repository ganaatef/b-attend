import { describe, expect, it } from "vitest";
import { attendanceTrustPolicyFromSettings } from "@/lib/attendance/trust-policy";

describe("tenant attendance trust policy", () => {
  it("uses safe defaults without company settings", () => {
    const policy = attendanceTrustPolicyFromSettings(null);
    expect(policy.reviewBelow).toBe(75);
    expect(policy.rejectBelow).toBe(30);
    expect(policy.blockCriticalRisk).toBe(false);
    expect(policy.requireFace).toBe(false);
    expect(policy.requireLiveness).toBe(false);
  });

  it("materializes tenant thresholds into a versioned policy", () => {
    const policy = attendanceTrustPolicyFromSettings({
      trustPolicyVersion: "ops-v2",
      trustReviewBelow: 82,
      trustRejectBelow: 25,
      trustBlockCriticalRisk: true,
      trustRequireFace: false,
      trustRequireLiveness: false,
    } as any);
    expect(policy.reviewBelow).toBe(82);
    expect(policy.rejectBelow).toBe(25);
    expect(policy.blockCriticalRisk).toBe(true);
    expect(policy.version).toContain("ops-v2:review-82:reject-25:critical-1");
  });
});
