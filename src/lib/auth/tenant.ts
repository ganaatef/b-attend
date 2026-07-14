/**
 * B-Attend tenant scoping & feature gate helpers.
 *
 * Phase 1: scaffolding only. Real enforcement arrives in Phases 2-7.
 * Every helper is intentionally side-effect-free and safe to call from RSC.
 */

import { db } from "@/lib/db";
import { requireTenantSession } from "./session";

/**
 * Returns the authenticated tenant's companyId, throwing if not a tenant session.
 */
export async function getTenantId(): Promise<string> {
  const s = await requireTenantSession();
  return s.tenantId as string;
}

/**
 * Returns the tenant row with its subscription & plan, or null.
 */
export async function getTenantContext(tenantId: string) {
  return db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: { include: { plan: { include: { features: true } } } },
    },
  });
}

export type TenantContext = Awaited<ReturnType<typeof getTenantContext>>;

/**
 * Phase 1 stub. Returns true for now.
 * Phase 2+ will enforce: PENDING_ACTIVATION, SUSPENDED, CANCELLED → block operational routes.
 */
export async function requireActiveSubscription(_tenantId: string): Promise<boolean> {
  // TODO Phase 2: enforce subscription status gates
  return true;
}

/**
 * Phase 1 stub. Returns true for now.
 * Phase 2+ will check PlanFeature.enabled for the given key.
 */
export async function canUseFeature(
  _tenantId: string,
  _featureKey: string
): Promise<boolean> {
  // TODO Phase 2: look up PlanFeature by tenant → subscription → plan → feature key
  return true;
}

/**
 * Check plan limits (maxBranches, maxEmployees, etc.). Phase 1 stub.
 */
export async function checkPlanLimit(
  _tenantId: string,
  _resource: "branches" | "employees" | "managers" | "kiosks"
): Promise<{ allowed: boolean; used: number; limit: number }> {
  // TODO Phase 2: count existing rows and compare to plan limit
  return { allowed: true, used: 0, limit: 999 };
}
