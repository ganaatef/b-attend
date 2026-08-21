/**
 * GET /api/public/plans — returns active plans for client-side selects.
 */
import { NextResponse } from "next/server";
import { getPublicPlans } from "@/lib/public-plans";

export async function GET() {
  try {
    const plans = (await getPublicPlans()).map((plan) => ({
      id: plan.id,
      name: plan.name,
      nameAr: plan.nameAr,
      slug: plan.slug,
      priceMonthly: plan.priceMonthly,
      priceAnnual: plan.priceAnnual,
      currency: plan.currency,
      isTrial: plan.isTrial,
      isCustom: plan.isCustom,
      maxBranches: plan.maxBranches,
      maxEmployees: plan.maxEmployees,
    }));
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
