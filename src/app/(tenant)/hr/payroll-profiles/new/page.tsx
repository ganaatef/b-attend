import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { PayrollProfileForm } from "./PayrollProfileForm";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function NewPayrollProfilePage() {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "BRANCH_MANAGER" || session.role === "EMPLOYEE") return null;
  if (!hasPerm(session.role, "MANAGE_PAYROLL")) return null;
  const tid = session.tenantId;

  const featureCheck = await canUseHrFeature(tid, "hr_payroll");
  if (!featureCheck.allowed) notFound();

  const employees = await db.employee.findMany({
    where: {
      companyId: tid,
      deletedAt: null,
      status: "ACTIVE",
      payrollProfile: null,
    },
    select: {
      id: true,
      fullName: true,
      employeeCode: true,
      branch: { select: { name: true } },
    },
    orderBy: { fullName: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <a href="/hr/payroll-profiles" className="text-xs text-muted-foreground hover:text-foreground">← Payroll Profiles</a>
        <h1 className="mt-1 text-lg font-bold text-foreground">New Payroll Profile</h1>
        <p className="text-xs text-muted-foreground">Tax and social insurance are not calculated in this MVP. All outputs require accountant review.</p>
      </div>
      <PayrollProfileForm employees={employees} />
    </div>
  );
}
