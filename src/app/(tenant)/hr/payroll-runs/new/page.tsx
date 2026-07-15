import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { NewPayrollRunForm } from "./NewPayrollRunForm";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function NewPayrollRunPage() {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "BRANCH_MANAGER" || session.role === "EMPLOYEE") return null;
  if (!hasPerm(session.role, "MANAGE_PAYROLL")) return null;

  const featureCheck = await canUseHrFeature(session.tenantId, "hr_payroll");
  if (!featureCheck.allowed) notFound();

  return <NewPayrollRunForm />;
}
