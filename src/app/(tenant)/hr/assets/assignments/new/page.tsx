import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getRolePermissions, getManagedBranchIds, type HrPermission } from "@/lib/hr/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewAssignmentForm } from "./NewAssignmentForm";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function NewAssignmentPage() {
  const t = await getTranslations("hrAssets");
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  if (!hasPerm(session.role, "MANAGE_ASSETS")) return null;

  const tid = session.tenantId;
  const isBranchManager = session.role === "BRANCH_MANAGER";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, tid) : [];
  const branchFilter = isBranchManager && managedBranchIds.length > 0 ? { branchId: { in: managedBranchIds } } : {};

  const [availableAssets, employees] = await Promise.all([
    db.asset.findMany({
      where: { companyId: tid, status: "AVAILABLE", ...branchFilter },
      select: { id: true, name: true, code: true, type: true },
      orderBy: { name: "asc" },
    }),
    db.employee.findMany({
      where: { companyId: tid, deletedAt: null, ...branchFilter },
      select: { id: true, fullName: true, employeeCode: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/assets/assignments" className="text-xs text-muted-foreground hover:text-foreground">{t("backToAssets")}</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">{t("newAssignment")}</h1>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("assignmentDetails")}</CardTitle></CardHeader>
        <CardContent>
          <NewAssignmentForm availableAssets={availableAssets} employees={employees} />
        </CardContent>
      </Card>
    </div>
  );
}
