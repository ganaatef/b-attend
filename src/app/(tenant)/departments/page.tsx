/** /departments */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { deleteDepartmentAction, createDepartmentAction } from "../actions";
import { Trash2, Layers } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const t = await getTranslations("departments");
  const departments = await db.department.findMany({
    where: { companyId: session.tenantId },
    include: { _count: { select: { employees: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div><h1 className="text-lg font-bold text-foreground">{t("title")}</h1><p className="text-sm text-muted-foreground">{departments.length} {t("title").toLowerCase()}.</p></div>
      <Card className="border-border p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t("addDepartmentBtn")}</h2>
        <form action={async (formData: FormData) => { "use server"; await createDepartmentAction({}, formData); }} className="flex gap-2">
          <div className="flex-1"><Label htmlFor="name" className="sr-only">{t("nameLabel")}</Label><Input id="name" name="name" required placeholder={t("kitchenPlaceholder")} /></div>
          <Button type="submit" size="sm">{t("addBtn")}</Button>
        </form>
      </Card>
      <Card className="border-border">
        {departments.length === 0 ? <EmptyState title={t("noDepartments")} icon={Layers} /> : (
          <div className="divide-y divide-border/60">
            {departments.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-foreground">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d._count.employees} {t("employeesLabel")}</p>
                </div>
                <form action={async () => { "use server"; await deleteDepartmentAction(d.id); }}>
                  <Button type="submit" variant="ghost" size="sm" className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
