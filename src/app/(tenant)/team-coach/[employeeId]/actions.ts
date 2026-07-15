"use server";

/**
 * Regenerate employee coach snapshot — Owner/HR only.
 * Employees cannot trigger regeneration (they use cached snapshots).
 */
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { generateEmployeeCoachSnapshot, type DateRange } from "@/lib/ai/coach-engine";
import { canUseAiFeature } from "@/lib/ai/feature-gates";

export async function regenerateEmployeeSnapshotAction(employeeId: string, periodStart: string, periodEnd: string) {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) {
    return { ok: false, error: "Unauthorized" };
  }
  // Only Owner/HR can regenerate
  if (session.role !== "COMPANY_OWNER" && session.role !== "HR_ADMIN") {
    return { ok: false, error: "Only owners and HR admins can regenerate snapshots." };
  }

  // Verify employee belongs to tenant
  const employee = await db.employee.findFirst({ where: { id: employeeId, companyId: session.tenantId } });
  if (!employee) return { ok: false, error: "Employee not found" };

  // Feature gate
  const gate = await canUseAiFeature(session.tenantId, "employee_coach_summary");
  if (!gate.allowed) return { ok: false, error: gate.reason };

  const range: DateRange = { start: new Date(periodStart), end: new Date(periodEnd) };
  await generateEmployeeCoachSnapshot(employeeId, range, { companyId: session.tenantId, userId: session.sub }, { regenerate: true });

  revalidatePath(`/team-coach/${employeeId}`);
  revalidatePath("/team-coach");
  return { ok: true };
}
