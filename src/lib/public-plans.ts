import { db } from "@/lib/db";
import type { Plan, PlanFeature } from "@prisma/client";

export type PublicPlan = Plan & { features: PlanFeature[] };

const featureKeys = [
  "mobile_clock",
  "kiosk",
  "csv_export",
  "approvals",
  "audit_log",
  "notifications",
  "support_tickets",
  "leave_requests",
  "permission_requests",
  "bulk_schedules",
  "multi_branch",
  "advanced_reports",
  "advanced_geofence",
  "api_access",
] as const;

const fallbackFeatureLabels: Record<(typeof featureKeys)[number], string> = {
  mobile_clock: "Mobile clock-in/out",
  kiosk: "Branch kiosk mode",
  csv_export: "CSV export",
  approvals: "Approval workflows",
  audit_log: "Audit log",
  notifications: "In-app notifications",
  support_tickets: "Support tickets",
  leave_requests: "Leave management",
  permission_requests: "Permission requests",
  bulk_schedules: "Bulk schedule generation",
  multi_branch: "Multi-branch management",
  advanced_reports: "Advanced reports",
  advanced_geofence: "Advanced geofence",
  api_access: "API access",
};

const planDefinitions = [
  {
    slug: "trial",
    name: "Trial",
    nameAr: "تجريبي",
    description: "14-day free trial. One branch, up to 10 employees.",
    priceMonthly: 0,
    priceAnnual: 0,
    maxBranches: 1,
    maxEmployees: 10,
    maxManagers: 1,
    maxKiosks: 1,
    reportsLevel: "BASIC" as const,
    auditRetentionDays: 30,
    supportLevel: "SELF_SERVICE" as const,
    isTrial: true,
    isCustom: false,
    sortOrder: 1,
    enabled: ["mobile_clock", "kiosk", "csv_export", "approvals", "audit_log", "notifications", "support_tickets", "permission_requests"],
  },
  {
    slug: "starter",
    name: "Starter",
    nameAr: "ستارتر",
    description: "Single branch getting started with digital attendance.",
    priceMonthly: 999,
    priceAnnual: 9990,
    maxBranches: 1,
    maxEmployees: 25,
    maxManagers: 2,
    maxKiosks: 1,
    reportsLevel: "BASIC" as const,
    auditRetentionDays: 90,
    supportLevel: "STANDARD" as const,
    isTrial: false,
    isCustom: false,
    sortOrder: 2,
    enabled: ["mobile_clock", "kiosk", "csv_export", "approvals", "audit_log", "notifications", "support_tickets", "leave_requests", "permission_requests"],
  },
  {
    slug: "growth",
    name: "Growth",
    nameAr: "نمو",
    description: "Multi-branch operators needing bulk scheduling and leave management.",
    priceMonthly: 2499,
    priceAnnual: 24990,
    maxBranches: 3,
    maxEmployees: 75,
    maxManagers: 6,
    maxKiosks: 3,
    reportsLevel: "ADVANCED" as const,
    auditRetentionDays: 180,
    supportLevel: "PRIORITY" as const,
    isTrial: false,
    isCustom: false,
    sortOrder: 3,
    enabled: [...featureKeys.slice(0, 12)],
  },
  {
    slug: "pro",
    name: "Pro",
    nameAr: "برو",
    description: "Larger chains needing advanced geofence and API access.",
    priceMonthly: 4999,
    priceAnnual: 49990,
    maxBranches: 10,
    maxEmployees: 250,
    maxManagers: 20,
    maxKiosks: 10,
    reportsLevel: "ADVANCED" as const,
    auditRetentionDays: 365,
    supportLevel: "PRIORITY" as const,
    isTrial: false,
    isCustom: false,
    sortOrder: 4,
    enabled: [...featureKeys],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    nameAr: "إنتربرايز",
    description: "Custom contracts, dedicated onboarding, and account management.",
    priceMonthly: 0,
    priceAnnual: 0,
    maxBranches: 100,
    maxEmployees: 5000,
    maxManagers: 500,
    maxKiosks: 200,
    reportsLevel: "ADVANCED" as const,
    auditRetentionDays: 730,
    supportLevel: "PRIORITY" as const,
    isTrial: false,
    isCustom: true,
    sortOrder: 5,
    enabled: [...featureKeys],
  },
] as const;

function fallbackPlans(): PublicPlan[] {
  const now = new Date(0);
  return planDefinitions.map((definition) => {
    const id = `fallback-${definition.slug}`;
    const enabled = new Set<string>(definition.enabled);
    const features = featureKeys.map((key): PlanFeature => ({
      id: `${id}-${key}`,
      planId: id,
      key,
      label: fallbackFeatureLabels[key],
      enabled: enabled.has(key),
      createdAt: now,
    }));

    return {
      id,
      slug: definition.slug,
      name: definition.name,
      nameAr: definition.nameAr,
      description: definition.description,
      priceMonthly: definition.priceMonthly,
      priceAnnual: definition.priceAnnual,
      currency: "EGP",
      maxBranches: definition.maxBranches,
      maxEmployees: definition.maxEmployees,
      maxManagers: definition.maxManagers,
      maxKiosks: definition.maxKiosks,
      reportsLevel: definition.reportsLevel,
      auditRetentionDays: definition.auditRetentionDays,
      supportLevel: definition.supportLevel,
      isCustom: definition.isCustom,
      isTrial: definition.isTrial,
      sortOrder: definition.sortOrder,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      features,
    };
  });
}

export async function getPublicPlans(): Promise<PublicPlan[]> {
  try {
    const plans = await db.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { features: true },
    });

    if (plans.length > 0) return plans;
    console.warn("[PublicPlans] No active plans found; using public fallback plans.");
  } catch (error) {
    console.warn("[PublicPlans] Database unavailable; using public fallback plans.", error);
  }

  return fallbackPlans();
}
