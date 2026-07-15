/**
 * HR feature gates.
 *
 * Plan availability:
 * - Trial: hr_core limited
 * - Starter: hr_core + basic documents + basic leave
 * - Growth: hr_core + documents + leave + training + assets + excel_export
 * - Pro: all HR features + payroll + advanced Excel
 * - Enterprise: all features + custom HR workflows placeholder
 */

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export type HrFeatureKey =
  | "hr_core"
  | "hr_documents"
  | "hr_leave"
  | "hr_training"
  | "hr_assets"
  | "hr_payroll"
  | "hr_excel_export"
  | "excel_export";

const PLAN_HR_FEATURES: Record<string, HrFeatureKey[]> = {
  trial: ["hr_core"],
  starter: ["hr_core", "hr_documents", "hr_leave"],
  growth: ["hr_core", "hr_documents", "hr_leave", "hr_training", "hr_assets", "excel_export", "hr_excel_export"],
  pro: ["hr_core", "hr_documents", "hr_leave", "hr_training", "hr_assets", "hr_payroll", "excel_export", "hr_excel_export"],
  enterprise: ["hr_core", "hr_documents", "hr_leave", "hr_training", "hr_assets", "hr_payroll", "excel_export", "hr_excel_export"],
};

export async function getTenantPlanSlug(tenantId: string): Promise<string | null> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: { include: { plan: true } } },
  });
  return tenant?.subscription?.plan?.slug ?? null;
}

export async function canUseHrFeature(tenantId: string, feature: HrFeatureKey): Promise<{ allowed: boolean; reason?: string }> {
  const planSlug = await getTenantPlanSlug(tenantId);
  if (!planSlug) return { allowed: false, reason: "No active subscription." };
  const allowedFeatures = PLAN_HR_FEATURES[planSlug] ?? [];
  if (!allowedFeatures.includes(feature)) {
    return { allowed: false, reason: `Your current plan (${planSlug}) does not include this HR feature. Upgrade to unlock it.` };
  }
  return { allowed: true };
}

export async function getCurrentUserHrFeature(feature: HrFeatureKey): Promise<{ allowed: boolean; reason?: string; tenantId?: string }> {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) {
    return { allowed: false, reason: "Authentication required." };
  }
  return canUseHrFeature(session.tenantId, feature);
}

export function getPlanHrFeaturesForSlug(slug: string): HrFeatureKey[] {
  return PLAN_HR_FEATURES[slug] ?? [];
}

export const HR_FEATURE_LABELS: Record<HrFeatureKey, string> = {
  hr_core: "HR Core",
  hr_documents: "HR Documents",
  hr_leave: "Leave Management",
  hr_training: "Training & Development",
  hr_assets: "Assets & Uniforms",
  hr_payroll: "Payroll-Ready Module",
  hr_excel_export: "HR Excel Export",
  excel_export: "Excel Export",
};

export const PLAN_HR_FEATURES_MAP = PLAN_HR_FEATURES;
