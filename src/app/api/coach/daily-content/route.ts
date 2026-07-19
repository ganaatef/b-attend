/**
 * GET /api/coach/daily-content?date=...&audience=...
 *
 * Returns (or generates) the daily coach content for the tenant.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { generateDailyMotivation } from "@/lib/ai/provider";
import { canUseAiFeature } from "@/lib/ai/feature-gates";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.kind !== "tenant" || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await canUseAiFeature(session.tenantId, "daily_motivation");
    if (!gate.allowed) return NextResponse.json({ error: gate.reason }, { status: 403 });

    const url = new URL(req.url);
    const dateStr = url.searchParams.get("date") ?? new Date().toISOString().split("T")[0];
    const audience = (url.searchParams.get("audience") ?? "ALL_EMPLOYEES") as any;
    const date = new Date(dateStr); date.setHours(0, 0, 0, 0);

    // Try fetching existing content
    let content = await db.dailyCoachContent.findUnique({
      where: { companyId_date_audience_language: { companyId: session.tenantId, date, audience, language: "EN" } },
    });

    if (!content) {
      // Generate
      const motivation = await generateDailyMotivation(
        { companyId: session.tenantId, userId: session.sub, feature: "daily_motivation" },
        { date, audience, language: "EN" },
      );
      content = await db.dailyCoachContent.create({
        data: {
          companyId: session.tenantId,
          date,
          title: motivation.title,
          body: motivation.body,
          theme: motivation.theme as any,
          language: "EN",
          audience,
          createdByAi: true,
        },
      });
    }

    return NextResponse.json({ ok: true, content });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
