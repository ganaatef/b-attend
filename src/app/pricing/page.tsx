/**
 * /pricing — resilient public pricing page.
 */
import { PricingClient } from "./PricingClient";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { getPublicPlans } from "@/lib/public-plans";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const plans = await getPublicPlans();
  return (
    <PublicLayout>
      <PricingClient plans={plans} />
    </PublicLayout>
  );
}
