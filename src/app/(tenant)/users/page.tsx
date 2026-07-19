/** /users — tenant user management */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { UserForm } from "./UserForm";
import { Users } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { getTranslations, getLocale } from "next-intl/server";
import { getStatusLabel } from "@/lib/status-labels";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const t = await getTranslations("users");
  const locale = await getLocale();
  const session = await getSession();
  if (!session?.tenantId) return null;
  if (session.role !== "COMPANY_OWNER" && session.role !== "HR_ADMIN") {
    return <div className="p-4 text-sm text-muted-foreground">{t("accessDenied")}</div>;
  }
  const [users, branches] = await Promise.all([
    db.user.findMany({ where: { companyId: session.tenantId }, include: { employee: true }, orderBy: { createdAt: "desc" } }),
    db.branch.findMany({ where: { companyId: session.tenantId, deletedAt: null } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div><h1 className="text-lg font-bold text-foreground">{t("title")}</h1><p className="text-sm text-muted-foreground">{t("count", { count: users.length })}</p></div>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("inviteNewUser")}</CardTitle></CardHeader>
        <CardContent><UserForm branches={branches} /></CardContent>
      </Card>
      <Card className="border-border">
        {users.length === 0 ? <EmptyState title={t("noUsers")} icon={Users} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t("name")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("email")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("role")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("status")}</th>
                  <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">{t("lastLogin")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{u.name}{u.employee && <span className="ml-1 text-xs text-muted-foreground">({u.employee.employeeCode})</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{getStatusLabel(u.role, locale)}</Badge></td>
                    <td className="px-4 py-3"><Badge variant={u.status === "ACTIVE" ? "default" : "secondary"} className={u.status === "ACTIVE" ? "bg-brand-success text-white border-transparent text-xs" : "text-xs"}>{getStatusLabel(u.status, locale)}</Badge></td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
