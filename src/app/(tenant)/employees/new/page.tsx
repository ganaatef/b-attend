/** /employees/new — full-page form */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeForm } from "../EmployeeForm";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  const t = await getTranslations("employees");
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const [branches, departments, policies] = await Promise.all([
    db.branch.findMany({ where: { companyId: session.tenantId, deletedAt: null } }),
    db.department.findMany({ where: { companyId: session.tenantId } }),
    db.shiftPolicy.findMany({ where: { companyId: session.tenantId } }),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/employees" className="text-xs text-muted-foreground hover:text-foreground">{t("backToList")}</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">{t("newEmployee")}</h1>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold text-foreground">{t("employeeDetails")}</CardTitle></CardHeader>
        <CardContent><EmployeeForm branches={branches} departments={departments} policies={policies} /></CardContent>
      </Card>
    </div>
  );
}
