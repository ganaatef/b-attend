/** /schedules/bulk */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BulkScheduleForm } from "./BulkScheduleForm";
import { getTranslations } from "next-intl/server";
import { getManagedBranchIds } from "@/lib/hr/permissions";

export const dynamic = "force-dynamic";

export default async function BulkSchedulePage() {
  const t = await getTranslations("schedules");
  const session = await getSession();
  if (!session?.tenantId) return null;
  const isBranchManager = session.role === "BRANCH_MANAGER";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, session.tenantId) : [];

  const branchWhere: any = { companyId: session.tenantId, deletedAt: null };
  if (isBranchManager) branchWhere.id = { in: managedBranchIds };

  const empWhere: any = { companyId: session.tenantId, deletedAt: null };
  if (isBranchManager) empWhere.branchId = { in: managedBranchIds };

  const [branches, employees, policies] = await Promise.all([
    db.branch.findMany({ where: branchWhere }),
    db.employee.findMany({ where: empWhere, orderBy: { fullName: "asc" } }),
    db.shiftPolicy.findMany({ where: { companyId: session.tenantId } }),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/schedules" className="text-xs text-muted-foreground hover:text-foreground">← {t("title")}</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">{t("bulkTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("bulkDescription")}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold text-foreground">{t("generateCard")}</CardTitle></CardHeader>
        <CardContent><BulkScheduleForm branches={branches} employees={employees} policies={policies} /></CardContent>
      </Card>
    </div>
  );
}
