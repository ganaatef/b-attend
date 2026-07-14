"use server";

/**
 * Super Admin AI controls server actions.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logPlatformEvent } from "@/lib/auth/audit";

async function requireSuperAdmin() {
  const s = await getSession();
  if (!s || s.kind !== "platform" || s.role !== "SUPER_ADMIN") throw new Error("FORBIDDEN");
  return s;
}

const SettingsSchema = z.object({
  aiModuleEnabled: z.enum(["true", "false"]).or(z.boolean()),
  aiProvider: z.enum(["MOCK", "OPENAI"]),
  aiDailyCoachEnabled: z.enum(["true", "false"]).or(z.boolean()),
  aiEmployeeInsightsEnabled: z.enum(["true", "false"]).or(z.boolean()),
});

export async function updateAiSettingsAction(prev: any, formData: FormData) {
  const s = await requireSuperAdmin();
  const parsed = SettingsSchema.safeParse({
    aiModuleEnabled: formData.get("aiModuleEnabled") ?? "true",
    aiProvider: formData.get("aiProvider"),
    aiDailyCoachEnabled: formData.get("aiDailyCoachEnabled") ?? "true",
    aiEmployeeInsightsEnabled: formData.get("aiEmployeeInsightsEnabled") ?? "true",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d: any = parsed.data;
  d.aiModuleEnabled = d.aiModuleEnabled === true || d.aiModuleEnabled === "true";
  d.aiDailyCoachEnabled = d.aiDailyCoachEnabled === true || d.aiDailyCoachEnabled === "true";
  d.aiEmployeeInsightsEnabled = d.aiEmployeeInsightsEnabled === true || d.aiEmployeeInsightsEnabled === "true";
  await db.systemSetting.update({ where: { isMain: true }, data: d });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "AI_SETTINGS_UPDATED", entityType: "SystemSetting", entityId: "main", afterData: d });
  revalidatePath("/admin/ai");
  return { ok: true };
}

export async function toggleTenantAiAction(tenantId: string, enabled: boolean) {
  const s = await requireSuperAdmin();
  await db.tenantAiSetting.upsert({
    where: { companyId: tenantId },
    update: { aiEnabled: enabled },
    create: { companyId: tenantId, aiEnabled: enabled },
  });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "AI_TENANT_TOGGLED", entityType: "Tenant", entityId: tenantId, afterData: { aiEnabled: enabled } });
  revalidatePath("/admin/ai");
  return { ok: true };
}
