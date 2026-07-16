/** /policies */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Clock } from "lucide-react";
import { PolicyForm } from "./PolicyForm";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const t = await getTranslations("policies");
  const session = await getSession();
  if (!session?.tenantId) return null;
  const policies = await db.shiftPolicy.findMany({
    where: { companyId: session.tenantId },
    include: { _count: { select: { schedules: true, employees: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div><h1 className="text-lg font-bold text-foreground">{t("title")}</h1><p className="text-sm text-muted-foreground">{t("count", { count: policies.length })}</p></div>
      <Card className="border-border p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t("addShiftPolicy")}</h2>
        <PolicyForm />
      </Card>
      <Card className="border-border">
        {policies.length === 0 ? <EmptyState title={t("noPolicies")} icon={Clock} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t("name")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("startEnd")}</th>
                  <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">{t("break")}</th>
                  <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">{t("lateGrace")}</th>
                  <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">{t("overtime")}</th>
                  <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">{t("weekend")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("employees")}</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3"><p className="font-medium text-foreground">{p.name}</p><Badge variant="outline" className="mt-1 text-xs">{p.status}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{p.startTime} → {p.endTime}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{p.breakMinutes}m</td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{p.lateGraceMinutes}m</td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{p.overtimeStartsAfterMinutes}m</td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">{p.weekendDays}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p._count.employees} emp · {p._count.schedules} sched</td>
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
