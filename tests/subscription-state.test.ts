import { describe, expect, it } from "vitest";
import { isTenantOperationalState } from "@/lib/auth/subscription-state";

const now = new Date("2026-09-09T20:00:00.000Z");

function tenant(overrides: Record<string, unknown> = {}) {
  return {
    deletedAt: null,
    status: "ACTIVE",
    subscription: {
      status: "ACTIVE",
      trialEndsAt: null,
      graceEndsAt: null,
      currentPeriodEnd: new Date("2026-10-09T20:00:00.000Z"),
    },
    ...overrides,
  } as any;
}

describe("isTenantOperationalState", () => {
  it("allows an active paid tenant inside its paid period", () => {
    expect(isTenantOperationalState(tenant(), now)).toBe(true);
  });

  it("allows an unexpired trial", () => {
    expect(isTenantOperationalState(tenant({
      status: "TRIAL_ACTIVE",
      subscription: {
        status: "TRIALING",
        trialEndsAt: new Date("2026-09-20T20:00:00.000Z"),
        graceEndsAt: null,
        currentPeriodEnd: null,
      },
    }), now)).toBe(true);
  });

  it("blocks an expired trial", () => {
    expect(isTenantOperationalState(tenant({
      status: "TRIAL_ACTIVE",
      subscription: {
        status: "TRIALING",
        trialEndsAt: new Date("2026-09-08T20:00:00.000Z"),
        graceEndsAt: null,
        currentPeriodEnd: null,
      },
    }), now)).toBe(false);
  });

  it("blocks a paid subscription after currentPeriodEnd", () => {
    expect(isTenantOperationalState(tenant({
      subscription: {
        status: "ACTIVE",
        trialEndsAt: null,
        graceEndsAt: null,
        currentPeriodEnd: new Date("2026-09-08T20:00:00.000Z"),
      },
    }), now)).toBe(false);
  });

  it("allows grace period before graceEndsAt", () => {
    expect(isTenantOperationalState(tenant({
      subscription: {
        status: "GRACE_PERIOD",
        trialEndsAt: null,
        graceEndsAt: new Date("2026-09-12T20:00:00.000Z"),
        currentPeriodEnd: null,
      },
    }), now)).toBe(true);
  });

  it("blocks expired grace period", () => {
    expect(isTenantOperationalState(tenant({
      subscription: {
        status: "GRACE_PERIOD",
        trialEndsAt: null,
        graceEndsAt: new Date("2026-09-09T19:59:59.000Z"),
        currentPeriodEnd: null,
      },
    }), now)).toBe(false);
  });

  for (const status of ["PENDING_ACTIVATION", "PAST_DUE", "SUSPENDED", "CANCELLED", "REJECTED"]) {
    it(`blocks tenant status ${status}`, () => {
      expect(isTenantOperationalState(tenant({ status }), now)).toBe(false);
    });
  }

  it("blocks deleted tenants and missing subscriptions", () => {
    expect(isTenantOperationalState(tenant({ deletedAt: now }), now)).toBe(false);
    expect(isTenantOperationalState(tenant({ subscription: null }), now)).toBe(false);
  });
});
