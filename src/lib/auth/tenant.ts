/**
 * Tenant access, subscription, feature, and plan-limit helpers.
 *
 * These checks are server-only and should guard every mutation that creates
 * billable tenant resources.
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { requireTenantSession } from "./session";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["TRIALING", "ACTIVE", "GRACE_PERIOD"]);
const BLOCKED_TENANT_STATUSES = new Set(["PENDING_ACTIVATION", "SUSPENDED", "CANCELLED", "REJECTED"]);

type SubscriptionWindow = {
  status: string;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
  currentPeriodEnd: Date | null;
};

/** Returns the authenticated tenant's companyId, throwing if not a tenant session. */
export async function getTenantId(): Promise<string> {
  const s = await requireTenantSession();
  return s.tenantId as string;
}

/** Returns the tenant row with its subscription and plan, or null. */
export async function getTenantContext(tenantId: string) {
  return db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: { include: { plan: { include: { features: true } } } },
    },
  });
}

function hasValidPeriod(subscription: SubscriptionWindow) {
  const now = Date.now();
  if (subscription.status === "TRIALING" && subscription.trialEndsAt && subscription.trialEndsAt.getTime() <= now) return false;
  if (subscription.status === "GRACE_PERIOD" && subscription.graceEndsAt && subscription.graceEndsAt.getTime() <= now) return false;
  if (subscription.status === "ACTIVE" && subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() <= now) return false;
  return true;
}

function isOperationalTenant(tenant: { deletedAt: Date | null; status: string; subscription: SubscriptionWindow | null }) {
  const subscription = tenant.subscription;
  return !tenant.deletedAt
    && !BLOCKED_TENANT_STATUSES.has(tenant.status)
    && !!subscription
    && ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)
    && hasValidPeriod(subscription);
}

/** Allows operational access only for a non-blocked tenant with a live subscription period. */
export async function requireActiveSubscription(tenantId: string): Promise<boolean> {
  const tenant = await getTenantContext(tenantId);
  return !!tenant && isOperationalTenant(tenant);
}

/** Checks a PlanFeature row after verifying that the subscription is operational. */
export async function canUseFeature(tenantId: string, featureKey: string): Promise<boolean> {
  const tenant = await getTenantContext(tenantId);
  if (!tenant || !isOperationalTenant(tenant) || !tenant.subscription) return false;
  return tenant.subscription.plan.features.some((feature) => feature.key === featureKey && feature.enabled);
}

async function countPlanResource(
  tx: Prisma.TransactionClient,
  tenantId: string,
  resource: "branches" | "employees" | "managers" | "kiosks",
) {
  if (resource === "branches") return tx.branch.count({ where: { companyId: tenantId, deletedAt: null } });
  if (resource === "employees") return tx.employee.count({ where: { companyId: tenantId, deletedAt: null } });
  if (resource === "managers") {
    return tx.user.count({
      where: {
        companyId: tenantId,
        deletedAt: null,
        status: { in: ["ACTIVE", "INVITED"] },
        role: { in: ["COMPANY_OWNER", "HR_ADMIN", "BRANCH_MANAGER"] },
      },
    });
  }
  // Kiosk records are not modeled yet; keep the gate conservative until they are.
  return 0;
}

function planLimitForResource(plan: { maxBranches: number; maxEmployees: number; maxManagers: number; maxKiosks: number }, resource: "branches" | "employees" | "managers" | "kiosks") {
  if (resource === "branches") return plan.maxBranches;
  if (resource === "employees") return plan.maxEmployees;
  if (resource === "managers") return plan.maxManagers;
  return plan.maxKiosks;
}

/** Counts active tenant resources and compares them with the subscribed plan. */
export async function checkPlanLimit(
  tenantId: string,
  resource: "branches" | "employees" | "managers" | "kiosks",
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const tenant = await getTenantContext(tenantId);
  const plan = tenant?.subscription?.plan;
  if (!tenant || !plan || !isOperationalTenant(tenant)) return { allowed: false, used: 0, limit: 0 };
  const used = await countPlanResource(db, tenantId, resource);
  const limit = planLimitForResource(plan, resource);
  return { allowed: used < limit, used, limit };
}

/**
 * Atomically checks a plan limit and performs the creation inside a serializable
 * transaction, preventing concurrent requests from exceeding a paid plan cap.
 */
export async function withPlanLimit<T>(
  tenantId: string,
  resource: "branches" | "employees" | "managers" | "kiosks",
  action: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  return db.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: { include: { plan: true } } },
    });
    const plan = tenant?.subscription?.plan;
    if (!tenant || !plan || !isOperationalTenant(tenant)) return { ok: false, error: "An active subscription is required." } as const;

    const used = await countPlanResource(tx, tenantId, resource);
    const limit = planLimitForResource(plan, resource);
    if (used >= limit) return { ok: false, error: `Plan limit reached (${limit} ${resource}).` } as const;

    const value = await action(tx);
    return { ok: true, value } as const;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

// Keep PrismaClient in the module's type graph for downstream generated clients.
export type TenantPrismaClient = PrismaClient;
