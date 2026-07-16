/** /hr/departments — Department CRUD with safe delete */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { hasHrPermission, getManagedBranchIds } from "@/lib/hr/permissions";
import { createHrDepartmentAction, deleteHrDepartmentAction } from "../actions";
import { Trash2, FolderTree, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HrDepartmentsPage() {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const tid = session.tenantId;
  const t = await getTranslations("hrDepartments");
  const th = await getTranslations("hrDashboard");

  const featureCheck = await canUseHrFeature(tid, "hr_core");
  if (!featureCheck.allowed) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Card className="border-dashed border-amber-300 bg-amber-50/40">
          <div className="pt-6 pb-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-amber-500" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">{th("requiresGrowthPlan")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{th("upgradeMessage")}</p>
          </div>
        </Card>
      </div>
    );
  }

  const canManage = await hasHrPermission("MANAGE_DEPARTMENTS");
  if (!canManage) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Card className="border-dashed border-destructive/40">
          <div className="pt-6 pb-6 text-center">
            <h3 className="text-sm font-semibold text-foreground">{th("accessDenied")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{th("noPermission")}</p>
          </div>
        </Card>
      </div>
    );
  }

  const departments = await db.department.findMany({
    where: { companyId: tid },
    include: { _count: { select: { employees: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("departmentCount", { count: departments.length })}</p>
      </div>

      <Card className="border-border p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t("addDepartment")}</h2>
        <form action={async (formData: FormData) => { "use server"; await createHrDepartmentAction({}, formData); }} className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="name" className="sr-only">{t("name")}</Label>
            <Input id="name" name="name" required placeholder={t("placeholder")} />
          </div>
          <Button type="submit" size="sm">{t("addDepartment")}</Button>
        </form>
      </Card>

      <Card className="border-border">
        {departments.length === 0 ? (
          <EmptyState title={t("noDepartments")} icon={FolderTree} />
        ) : (
          <div className="divide-y divide-border/60">
            {departments.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium text-foreground">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{t("employeesCount", { count: d._count.employees })}</p>
                  </div>
                  {!d.active && <Badge variant="outline" className="text-[10px]">{t("inactive")}</Badge>}
                </div>
                <form action={async () => {
                  "use server";
                  const result = await deleteHrDepartmentAction(d.id);
                  if (result?.deactivated) {
                    console.log(result.message);
                  }
                }}>
                  <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
