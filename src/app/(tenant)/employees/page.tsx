/** /employees */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Users, Plus } from "lucide-react";
import { EmployeeForm } from "./EmployeeForm";
import { getTranslations, getLocale } from "next-intl/server";
import { employeeDisplayName } from "@/lib/employee-display";
import { getStatusLabel } from "@/lib/status-labels";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const t = await getTranslations("employees");
  const locale = await getLocale();
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 50;
  const employeeWhere = { companyId: session.tenantId, deletedAt: null };
  const [employeeCount, employees, branches, departments, policies] = await Promise.all([
    db.employee.count({ where: employeeWhere }),
    db.employee.findMany({
      where: employeeWhere,
      include: { branch: true, department: true },
      orderBy: { employeeCode: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.branch.findMany({ where: { companyId: session.tenantId, deletedAt: null } }),
    db.department.findMany({ where: { companyId: session.tenantId } }),
    db.shiftPolicy.findMany({ where: { companyId: session.tenantId } }),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-bold text-foreground">{t("title")}</h1><p className="text-sm text-muted-foreground">{t("count", { count: employeeCount })}</p></div>
        <Link href="/employees/new" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="h-3.5 w-3.5" /> {t("newEmployee")}</Link>
      </div>
      <Card className="border-border p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t("quickAdd")}</h2>
        <EmployeeForm branches={branches} departments={departments} policies={policies} />
      </Card>
      <Card className="border-border">
        {employees.length === 0 ? <EmptyState title={t("noEmployees")} icon={Users} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t("code")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("name")}</th>
                  <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">{t("branch")}</th>
                  <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">{t("department")}</th>
                  <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">{t("jobTitle")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3"><Link href={`/employees/${e.id}`} className="font-medium text-brand-accent hover:underline">{e.employeeCode}</Link></td>
                    <td className="px-4 py-3"><p className="font-medium text-foreground">{employeeDisplayName(e, locale)}</p><p className="text-xs text-muted-foreground">{e.phone ?? "—"}</p></td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{e.branch?.name ?? "—"}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{e.department?.name ?? "—"}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{e.jobTitle ?? "—"}</td>
                    <td className="px-4 py-3"><Badge variant={e.status === "ACTIVE" ? "default" : "destructive"} className={e.status === "ACTIVE" ? "bg-brand-success text-white border-transparent text-xs" : "text-xs"}>{getStatusLabel(e.status, locale)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {employeeCount > pageSize ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">{t("pageOf", { page, pages: Math.ceil(employeeCount / pageSize) })}</span>
          <div className="flex items-center gap-2">
            {page > 1 ? <Link href={`/employees?page=${page - 1}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">{t("previous")}</Link> : null}
            {page < Math.ceil(employeeCount / pageSize) ? <Link href={`/employees?page=${page + 1}`} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">{t("next")}</Link> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
