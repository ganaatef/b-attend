/**
 * /pricing — server component fetches plans from DB, passes to PricingClient.
 */
import { PublicLayout } from "@/components/layout/PublicLayout";
import { getPublicPlans } from "@/lib/public-plans";
import { PricingClient } from "./PricingClient";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const plans = await getPublicPlans();
  return (
    <PublicLayout>
      <PricingClient plans={plans} />
    </PublicLayout>
  );
}
