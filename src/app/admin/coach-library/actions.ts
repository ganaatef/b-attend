"use server";

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

const TipSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(10),
  theme: z.string().min(1),
  roleTarget: z.string().default("ALL_EMPLOYEES"),
  language: z.string().default("EN"),
});

export async function createSystemTipAction(prev: any, formData: FormData) {
  const s = await requireSuperAdmin();
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
      companyId: null,
      title: d.title,
      body: d.body,
      theme: d.theme as any,
      roleTarget: d.roleTarget as any,
      language: d.language as any,
      isSystemDefault: true,
      active: true,
    },
  });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "COACH_TIP_CREATED", entityType: "CoachTip", reason: "System default" });
  revalidatePath("/admin/coach-library");
  return { ok: true };
}

export async function toggleSystemTipAction(tipId: string) {
  const s = await requireSuperAdmin();
  const tip = await db.coachTip.findFirst({ where: { id: tipId, isSystemDefault: true } });
  if (!tip) return { ok: false, error: "Tip not found" };
  await db.coachTip.update({ where: { id: tipId }, data: { active: !tip.active } });
  revalidatePath("/admin/coach-library");
  return { ok: true };
}

export async function deleteSystemTipAction(tipId: string) {
  const s = await requireSuperAdmin();
  await db.coachTip.deleteMany({ where: { id: tipId, isSystemDefault: true } });
  revalidatePath("/admin/coach-library");
  return { ok: true };
}
