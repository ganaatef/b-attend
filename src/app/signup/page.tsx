/**
 * /signup — server entry. Loads plans from DB and passes to SignupClient.
 */
import { db } from "@/lib/db";
import { SignupClient } from "./SignupClient";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const plans = await db.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return <SignupClient plans={plans} />;
}
