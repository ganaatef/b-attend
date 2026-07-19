/**
 * GET /api/coach/tips?theme=...&audience=...&language=...
 *
 * Returns active coach tips visible to the tenant (system defaults + tenant custom).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { canUseAiFeature } from "@/lib/ai/feature-gates";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.kind !== "tenant" || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Coach library is gated, but tips are also shown on /coach which is gated by ai_coach
    // So we allow if either ai_coach or coach_library is allowed
    const coachGate = await canUseAiFeature(session.tenantId, "ai_coach");
    const libraryGate = await canUseAiFeature(session.tenantId, "coach_library");
    if (!coachGate.allowed && !libraryGate.allowed) {
      return NextResponse.json({ error: coachGate.reason }, { status: 403 });
    }

    const url = new URL(req.url);
    const theme = url.searchParams.get("theme");
    const audience = url.searchParams.get("audience");
    const language = url.searchParams.get("language") ?? "EN";

    const where: any = {
      OR: [{ companyId: session.tenantId }, { isSystemDefault: true }],
      active: true,
      language,
    };
    if (theme) where.theme = theme;
    if (audience) where.roleTarget = audience;

    const tips = await db.coachTip.findMany({ where, orderBy: [{ isSystemDefault: "desc" }, { createdAt: "desc" }], take: 50 });
    return NextResponse.json({ ok: true, tips });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
