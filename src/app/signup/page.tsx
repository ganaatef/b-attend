/**
 * /signup — public signup entry.
 */
import { SignupClient } from "./SignupClient";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { getPublicPlans } from "@/lib/public-plans";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const plans = await getPublicPlans();
  return (
    <PublicLayout>
      <SignupClient plans={plans} />
    </PublicLayout>
  );
}
