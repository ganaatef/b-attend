/**
 * /signup — server entry. Loads plans from DB and passes to SignupClient.
 */
import { PublicLayout } from "@/components/layout/PublicLayout";
import { getPublicPlans } from "@/lib/public-plans";
import { SignupClient } from "./SignupClient";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const plans = await getPublicPlans();
  return (
    <PublicLayout>
      <SignupClient plans={plans} />
    </PublicLayout>
  );
}
