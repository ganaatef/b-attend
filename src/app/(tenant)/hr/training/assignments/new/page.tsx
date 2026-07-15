import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getRolePermissions, getManagedBranchIds, type HrPermission } from "@/lib/hr/permissions";
import { NewAssignmentForm } from "./NewAssignmentForm";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function NewAssignmentPage() {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  if (!hasPerm(session.role, "MANAGE_TRAINING")) return null;

  const tid = session.tenantId;
  const isBranchManager = session.role === "BRANCH_MANAGER";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, tid) : [];
  const branchFilter = isBranchManager && managedBranchIds.length > 0 ? { branchId: { in: managedBranchIds } } : {};

  const [employees, courses] = await Promise.all([
    db.employee.findMany({ where: { companyId: tid, deletedAt: null, ...branchFilter }, select: { id: true, fullName: true, employeeCode: true }, orderBy: { fullName: "asc" } }),
    db.trainingCourse.findMany({ where: { companyId: tid, active: true }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);

  return <NewAssignmentForm employees={employees} courses={courses} />;
}
