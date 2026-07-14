/**
 * B-Coach feature gates.
 *
 * Plan availability:
 * - Trial: daily_motivation only
 * - Starter: daily_motivation + ai_coach
 * - Growth: ai_coach + manager_ai_insights + coach_library
 * - Pro: all AI features + daily_briefing
 * - Enterprise: all features
 *
 * Super Admin can also disable AI globally or per-tenant.
 */

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export type AiFeatureKey = "ai_coach" | "daily_motivation" | "manager_ai_insights" | "coach_library" | "daily_briefing";

const PLAN_FEATURES: Record<string, AiFeatureKey[]> = {
  trial: ["daily_motivation"],
  starter: ["daily_motivation", "ai_coach"],
  growth: ["ai_coach", "daily_motivation", "manager_ai_insights", "coach_library"],
  pro: ["ai_coach", "daily_motivation", "manager_ai_insights", "coach_library", "daily_briefing"],
  enterprise: ["ai_coach", "daily_motivation", "manager_ai_insights", "coach_library", "daily_briefing"],
};

export async function getTenantPlanSlug(tenantId: string): Promise<string | null> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: { include: { plan: true } } },
  });
  return tenant?.subscription?.plan?.slug ?? null;
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
    manager_ai_insights: tenantSettings.managerInsights,
    coach_library: tenantSettings.coachLibrary,
    daily_briefing: tenantSettings.dailyBriefing,
  };
  if (!featureToggleMap[feature]) return { allowed: false, reason: `The ${feature.replace(/_/g, " ")} feature is disabled for your company.` };

  // 3. Plan feature gate
  const planSlug = await getTenantPlanSlug(tenantId);
  if (!planSlug) return { allowed: false, reason: "No active subscription." };
  const allowedFeatures = PLAN_FEATURES[planSlug] ?? [];
  if (!allowedFeatures.includes(feature)) {
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
  manager_ai_insights: "Manager AI Insights",
  coach_library: "Coach Tips Library",
  daily_briefing: "Daily Briefing",
};

export const PLAN_AI_FEATURES = PLAN_FEATURES;
