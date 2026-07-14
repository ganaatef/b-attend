/**
 * B-Coach feature gates.
 *
 * Plan availability (per new spec):
 * - Trial: daily_motivation only
 * - Starter: daily_motivation + employee_coach_summary
 * - Growth: daily_motivation + employee_coach_summary + manager_ai_insights + coach_library
 * - Pro: all B-Coach features + daily_briefing + ai_usage_logs
 * - Enterprise: all B-Coach features + custom_coach_templates + custom AI tone settings placeholder
 *
 * B-Coach add-on (purchasable separately):
 * - 499 EGP/month for up to 25 employees (TIER_25)
 * - 999 EGP/month for up to 75 employees (TIER_75)
 * - Custom for larger teams (CUSTOM)
 * Add-on unlocks ai_coach + employee_coach_summary + manager_ai_insights + coach_library + daily_briefing
 * regardless of base plan (except Trial which is always daily_motivation only).
 *
 * Super Admin can also disable AI globally or per-tenant.
 */

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export type AiFeatureKey =
  | "ai_coach"
  | "daily_motivation"
  | "employee_coach_summary"
  | "manager_ai_insights"
  | "coach_library"
  | "daily_briefing"
  | "ai_usage_logs"
  | "custom_coach_templates";

const PLAN_FEATURES: Record<string, AiFeatureKey[]> = {
  trial: ["daily_motivation"],
  starter: ["daily_motivation", "employee_coach_summary"],
  growth: ["daily_motivation", "employee_coach_summary", "manager_ai_insights", "coach_library"],
  pro: ["daily_motivation", "employee_coach_summary", "manager_ai_insights", "coach_library", "daily_briefing", "ai_usage_logs", "ai_coach"],
  enterprise: ["daily_motivation", "employee_coach_summary", "manager_ai_insights", "coach_library", "daily_briefing", "ai_usage_logs", "ai_coach", "custom_coach_templates"],
};

// B-Coach add-on unlocks these features (on top of the base plan)
const ADDON_FEATURES: AiFeatureKey[] = ["ai_coach", "employee_coach_summary", "manager_ai_insights", "coach_library", "daily_briefing"];

export async function getTenantPlanSlug(tenantId: string): Promise<string | null> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: { include: { plan: true } } },
  });
  return tenant?.subscription?.plan?.slug ?? null;
}

export async function getTenantSubscription(tenantId: string) {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: true },
  });
  return tenant?.subscription ?? null;
}

export async function isAiGloballyEnabled(): Promise<boolean> {
  const settings = await db.systemSetting.findFirst({ where: { isMain: true } });
  return settings?.aiModuleEnabled ?? true;
}

export async function getTenantAiSettings(tenantId: string) {
  let settings = await db.tenantAiSetting.findUnique({ where: { companyId: tenantId } });
  if (!settings) {
    settings = await db.tenantAiSetting.create({ data: { companyId: tenantId } });
  }
  return settings;
}

export async function canUseAiFeature(tenantId: string, feature: AiFeatureKey): Promise<{ allowed: boolean; reason?: string }> {
  // 1. Global AI switch
  const globalEnabled = await isAiGloballyEnabled();
  if (!globalEnabled) return { allowed: false, reason: "AI module is disabled globally by the platform admin." };

  // 2. Tenant AI settings
  const tenantSettings = await getTenantAiSettings(tenantId);
  if (!tenantSettings.aiEnabled) return { allowed: false, reason: "AI module is disabled for your company." };
  const featureToggleMap: Record<AiFeatureKey, boolean> = {
    ai_coach: tenantSettings.employeeCoach,
    daily_motivation: tenantSettings.dailyMotivation,
    employee_coach_summary: tenantSettings.employeeCoachSummary,
    manager_ai_insights: tenantSettings.managerInsights,
    coach_library: tenantSettings.coachLibrary,
    daily_briefing: tenantSettings.dailyBriefing,
    ai_usage_logs: tenantSettings.aiUsageLogs,
    custom_coach_templates: tenantSettings.customCoachTemplates,
  };
  if (!featureToggleMap[feature]) return { allowed: false, reason: `The ${feature.replace(/_/g, " ")} feature is disabled for your company.` };

  // 3. Plan feature gate
  const planSlug = await getTenantPlanSlug(tenantId);
  if (!planSlug) return { allowed: false, reason: "No active subscription." };
  let allowedFeatures = PLAN_FEATURES[planSlug] ?? [];

  // 4. B-Coach add-on unlocks more features
  const subscription = await getTenantSubscription(tenantId);
  if (subscription?.bcoachAddOnEnabled && planSlug !== "trial") {
    allowedFeatures = [...new Set([...allowedFeatures, ...ADDON_FEATURES])];
  }

  if (!allowedFeatures.includes(feature)) {
    if (planSlug === "trial") {
      return { allowed: false, reason: "B-Coach is available on Growth, Pro, and Enterprise plans. Upgrade to unlock AI staff coaching and team insights." };
    }
    return { allowed: false, reason: `Your current plan (${planSlug}) does not include this AI feature. Upgrade to unlock it.` };
  }

  return { allowed: true };
}

export async function requireAiFeature(tenantId: string, feature: AiFeatureKey): Promise<void> {
  const result = await canUseAiFeature(tenantId, feature);
  if (!result.allowed) {
    throw new Error(`AI_FEATURE_GATE:${result.reason ?? "Feature not available"}`);
  }
}

export async function getCurrentUserAiFeature(feature: AiFeatureKey): Promise<{ allowed: boolean; reason?: string; tenantId?: string }> {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) {
    return { allowed: false, reason: "Authentication required." };
  }
  return canUseAiFeature(session.tenantId, feature);
}

export function getPlanFeaturesForSlug(slug: string): AiFeatureKey[] {
  return PLAN_FEATURES[slug] ?? [];
}

export const AI_FEATURE_LABELS: Record<AiFeatureKey, string> = {
  ai_coach: "Employee AI Coach",
  daily_motivation: "Daily Motivation",
  employee_coach_summary: "Employee Coach Summary",
  manager_ai_insights: "Manager AI Insights",
  coach_library: "Coach Tips Library",
  daily_briefing: "Daily Briefing",
  ai_usage_logs: "AI Usage Logs",
  custom_coach_templates: "Custom Coach Templates",
};

export const PLAN_AI_FEATURES = PLAN_FEATURES;
export const ADDON_AI_FEATURES = ADDON_FEATURES;

// B-Coach add-on pricing tiers
export const BCOACH_ADDON_TIERS = [
  { tier: "TIER_25", label: "Up to 25 employees", price: 499, currency: "EGP" },
  { tier: "TIER_75", label: "Up to 75 employees", price: 999, currency: "EGP" },
  { tier: "CUSTOM", label: "Custom (75+ employees)", price: 0, currency: "EGP" },
] as const;

export const UPGRADE_PROMPT_EN = "B-Coach is available on Growth, Pro, and Enterprise plans. Upgrade to unlock AI staff coaching and team insights.";
export const UPGRADE_PROMPT_AR = "ميزة B-Coach متاحة في باقات Growth و Pro و Enterprise. قم بالترقية لتفعيل مدرب الموظفين الذكي.";
