export type SubscriptionStateInput = {
  status: string;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
  currentPeriodEnd: Date | null;
};

export type TenantStateInput = {
  deletedAt: Date | null;
  status: string;
  subscription: SubscriptionStateInput | null;
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["TRIALING", "ACTIVE", "GRACE_PERIOD"]);
const BLOCKED_TENANT_STATUSES = new Set([
  "PENDING_ACTIVATION",
  "PAST_DUE",
  "SUSPENDED",
  "CANCELLED",
  "REJECTED",
]);

export function isTenantOperationalState(tenant: TenantStateInput, now = new Date()): boolean {
  const subscription = tenant.subscription;
  if (tenant.deletedAt || BLOCKED_TENANT_STATUSES.has(tenant.status) || !subscription) return false;
  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) return false;

  const nowMs = now.getTime();
  if (subscription.status === "TRIALING" && subscription.trialEndsAt && subscription.trialEndsAt.getTime() <= nowMs) return false;
  if (subscription.status === "GRACE_PERIOD" && subscription.graceEndsAt && subscription.graceEndsAt.getTime() <= nowMs) return false;
  if (subscription.status === "ACTIVE" && subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() <= nowMs) return false;

  return true;
}
