"use server";

/**
 * Coach library server actions.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logTenantEvent } from "@/lib/auth/audit";

async function requireTenantAdmin() {
  const s = await getSession();
  if (!s || s.kind !== "tenant" || !s.tenantId) throw new Error("FORBIDDEN");
  if (s.role !== "COMPANY_OWNER" && s.role !== "HR_ADMIN") throw new Error("FORBIDDEN");
  return s;
}

const TipSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(10),
  theme: z.string().min(1),
  roleTarget: z.string().default("ALL_EMPLOYEES"),
  language: z.string().default("EN"),
});

export async function createTipAction(prev: any, formData: FormData) {
  try {
    const s = await requireTenantAdmin();
    const parsed = TipSchema.safeParse({
      title: formData.get("title"),
      body: formData.get("body"),
      theme: formData.get("theme"),
      roleTarget: formData.get("roleTarget") ?? "ALL_EMPLOYEES",
      language: formData.get("language") ?? "EN",
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
    const d = parsed.data;
    await db.coachTip.create({
      data: {
        companyId: s.tenantId!,
        title: d.title,
        body: d.body,
        theme: d.theme as any,
        roleTarget: d.roleTarget as any,
        language: d.language as any,
        isSystemDefault: false,
        active: true,
      },
    });
    await logTenantEvent({ companyId: s.tenantId!, actorId: s.sub, actorEmail: s.email, action: "COACH_TIP_CREATED", entityType: "CoachTip" });
    revalidatePath("/coach-library");
    return { ok: true };
  } catch (e) {
    console.error("[actions] createTipAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function toggleTipAction(tipId: string) {
  try {
    const s = await requireTenantAdmin();
    const tip = await db.coachTip.findFirst({ where: { id: tipId, companyId: s.tenantId! } });
    if (!tip) return { ok: false, error: "Tip not found" };
    await db.coachTip.update({ where: { id: tipId }, data: { active: !tip.active } });
    revalidatePath("/coach-library");
    return { ok: true };
  } catch (e) {
    console.error("[actions] toggleTipAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function deleteTipAction(tipId: string) {
  try {
    const s = await requireTenantAdmin();
    await db.coachTip.deleteMany({ where: { id: tipId, companyId: s.tenantId!, isSystemDefault: false } });
    revalidatePath("/coach-library");
    return { ok: true };
  } catch (e) {
    console.error("[actions] deleteTipAction failed:", e);
    return { ok: false, error: "An unexpected error occurred. Please try again." };
  }
}
