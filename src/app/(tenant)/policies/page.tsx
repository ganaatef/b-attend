/** /policies */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Button } from "@/components/ui/button";
import { Clock, Plus } from "lucide-react";
import { PolicyForm } from "./PolicyForm";
import { getTranslations } from "next-intl/server";
import { TimeRange } from "@/components/LtrValue";
import { displayWeekendDays, displayShiftName } from "@/lib/locale-display";
import { getStatusLabel } from "@/lib/status-labels";
import { getLocaleCode } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const t = await getTranslations("policies");
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;

  const locale = await getLocaleCode();

  const policies = await db.shiftPolicy.findMany({
    where: { companyId: session.tenantId },
    include: { _count: { select: { schedules: true, employees: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-base text-muted-foreground">
            {t("count", { count: policies.length })}
          </p>
        </div>
      </div>

      <Card className="border-border p-6">
        <h2 className="mb-4 text-lg font-bold text-foreground">{t("addShiftPolicy")}</h2>
        <PolicyForm />
      </Card>

      <Card className="border-border">
        {policies.length === 0 ? (
          <EmptyState title={t("noPolicies")} icon={Clock} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-start text-sm font-semibold text-muted-foreground">{t("name")}</th>
                  <th className="px-4 py-3 text-start text-sm font-semibold text-muted-foreground">{t("startEnd")}</th>
                  <th className="hidden px-4 py-3 text-start text-sm font-semibold text-muted-foreground md:table-cell">{t("break")}</th>
                  <th className="hidden px-4 py-3 text-start text-sm font-semibold text-muted-foreground md:table-cell">{t("lateGrace")}</th>
                  <th className="hidden px-4 py-3 text-start text-sm font-semibold text-muted-foreground md:table-cell">{t("overtime")}</th>
                  <th className="hidden px-4 py-3 text-start text-sm font-semibold text-muted-foreground md:table-cell">{t("weekend")}</th>
                  <th className="px-4 py-3 text-start text-sm font-semibold text-muted-foreground">{t("employees")}</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{displayShiftName(p.name, locale)}</p>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {getStatusLabel(p.status, locale)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <TimeRange start={p.startTime} end={p.endTime} />
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                      <bdi dir="ltr">{p.breakMinutes} {locale === "ar" ? "دقيقة" : "min"}</bdi>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                      <bdi dir="ltr">{p.lateGraceMinutes} {locale === "ar" ? "دقيقة" : "min"}</bdi>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                      <bdi dir="ltr">{p.overtimeStartsAfterMinutes} {locale === "ar" ? "دقيقة" : "min"}</bdi>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                      {displayWeekendDays(p.weekendDays ?? "", locale)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <span className="block">{t("countEmployees", { count: p._count.employees })}</span>
                      <span className="block">{t("countSchedules", { count: p._count.schedules })}</span>
                    </td>
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
