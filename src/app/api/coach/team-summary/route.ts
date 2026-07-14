/**
 * GET /api/coach/team-summary?branchId=...&from=...&to=...
 *
 * Returns the AI-generated team coach summary.
 * Manager/HR/Owner only. Branch managers scoped to their branch.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { generateTeamCoachSnapshot, type DateRange } from "@/lib/ai/coach-engine";
import { canUseAiFeature } from "@/lib/ai/feature-gates";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gate = await canUseAiFeature(session.tenantId, "manager_ai_insights");
  if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: 403 });

  const url = new URL(req.url);
  let branchId = url.searchParams.get("branchId");

  // Branch manager scope
  if (session.role === "BRANCH_MANAGER") {
    const user = await db.user.findUnique({ where: { id: session.sub } });
    const managed = await db.branch.findMany({ where: { companyId: session.tenantId, managerId: user?.id } });
    if (managed.length === 0) return NextResponse.json({ error: "No managed branch" }, { status: 403 });
    branchId = managed[0].id;
  }

  const today = new Date();
  const from = url.searchParams.get("from") ?? new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const to = url.searchParams.get("to") ?? today.toISOString().split("T")[0];
  const range: DateRange = { start: new Date(from), end: new Date(to) };

  const result = await generateTeamCoachSnapshot(session.tenantId, branchId, range, { userId: session.sub });
  return NextResponse.json({ ok: true, ...result });
}
