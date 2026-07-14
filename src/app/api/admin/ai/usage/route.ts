/**
 * GET /api/admin/ai/usage — AI usage logs for Super Admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.kind !== "platform") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
  const feature = url.searchParams.get("feature");

  const where: any = {};
  if (feature) where.feature = feature;

  const logs = await db.aiUsageLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { tenant: true },
  });

  return NextResponse.json({ ok: true, logs });
}
