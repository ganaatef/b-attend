/** /branches/[id] */
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Building2, Users, CalendarClock } from "lucide-react";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("branches");
  const session = await getSession();
  if (!session?.tenantId) return null;
  const { id } = await params;
  const branch = await db.branch.findFirst({ where: { id, companyId: session.tenantId, deletedAt: null } });
  if (!branch) notFound();

  const [employees, schedulesToday] = await Promise.all([
    db.employee.findMany({ where: { branchId: id, deletedAt: null }, include: { department: true } }),
    db.schedule.findMany({ where: { branchId: id, date: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lt: new Date(new Date().setHours(24, 0, 0, 0)) } }, include: { employee: true } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <Link href="/branches" className="text-xs text-muted-foreground hover:text-foreground">← Branches</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">{branch.name}</h1>
        <p className="text-sm text-muted-foreground">{branch.code} · {branch.address ?? branch.city ?? "No address"}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{t("geofenceRadius")}</p><p className="text-lg font-bold text-foreground">{branch.geofenceRadius}m</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{t("employeesLabel")}</p><p className="text-lg font-bold text-foreground">{employees.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{t("scheduledToday")}</p><p className="text-lg font-bold text-foreground">{schedulesToday.length}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("employeesAtBranch")}</CardTitle></CardHeader>
        <CardContent>
          {employees.length === 0 ? <EmptyState title={t("noEmployees")} icon={Users} /> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {employees.map((e) => (
                <Link key={e.id} href={`/employees/${e.id}`} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted/40">
                  <div><p className="font-medium text-foreground">{e.fullName}</p><p className="text-xs text-muted-foreground">{e.employeeCode} · {e.department?.name ?? "—"}</p></div>
                  <span className="text-xs text-muted-foreground">{e.jobTitle ?? "—"}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
