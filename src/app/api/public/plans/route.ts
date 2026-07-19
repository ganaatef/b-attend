/**
 * GET /api/public/plans — returns active plans for client-side selects.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const plans = await db.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true, priceMonthly: true, priceAnnual: true, currency: true, isTrial: true, isCustom: true },
    });
    return NextResponse.json({ plans }, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
