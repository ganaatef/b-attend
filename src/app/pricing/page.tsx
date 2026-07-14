/**
 * /pricing — server component fetches plans from DB, passes to PricingClient.
 */
import { db } from "@/lib/db";
import { PricingClient } from "./PricingClient";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const plans = await db.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { features: true },
  });
  return <PricingClient plans={plans} />;
}
