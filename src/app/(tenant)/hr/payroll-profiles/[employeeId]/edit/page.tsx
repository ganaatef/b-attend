import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { PayrollProfileEditForm } from "./PayrollProfileEditForm";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function EditPayrollProfilePage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "BRANCH_MANAGER" || session.role === "EMPLOYEE") return null;
  if (!hasPerm(session.role, "MANAGE_PAYROLL")) return null;
  const tid = session.tenantId;
  const { employeeId } = await params;

  const featureCheck = await canUseHrFeature(tid, "hr_payroll");
  if (!featureCheck.allowed) notFound();

  const profile = await db.payrollProfile.findFirst({
    where: { employeeId, companyId: tid },
    include: {
      employee: {
        select: { id: true, fullName: true, employeeCode: true },
      },
    },
  });
  if (!profile) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <a href={`/hr/payroll-profiles/${profile.employeeId}`} className="text-xs text-muted-foreground hover:text-foreground">← Payroll Profile</a>
        <h1 className="mt-1 text-lg font-bold text-foreground">Edit Payroll Profile</h1>
        <p className="text-sm text-muted-foreground">{profile.employee.fullName} ({profile.employee.employeeCode})</p>
      </div>
      <PayrollProfileEditForm profile={profile} />
    </div>
  );
}
