/** /live — Live attendance feed for today. */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Activity } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { getTranslations, getLocale } from "next-intl/server";
import { employeeDisplayName } from "@/lib/employee-display";
import { displayPunchType } from "@/lib/locale-display";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const t = await getTranslations("live");
  const locale = await getLocale();
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  // Branch managers see only their branch
  const user = await db.user.findUnique({ where: { id: session.sub } });
  let branchFilter: any = {};
  if (user?.role === "BRANCH_MANAGER") {
    // Find branches managed by this user (using managerId field)
    const managedBranches = await db.branch.findMany({ where: { companyId: session.tenantId, managerId: user.id, deletedAt: null } });
    branchFilter = { branchId: { in: managedBranches.map((b) => b.id) } };
  }

  const [punches, attendance] = await Promise.all([
    db.punch.findMany({
      where: { companyId: session.tenantId, timestamp: { gte: today, lt: tomorrow }, ...branchFilter },
      include: { employee: true, branch: true },
      orderBy: { timestamp: "desc" },
      take: 100,
    }),
    db.attendanceDay.findMany({
      where: { companyId: session.tenantId, date: today, ...branchFilter },
      include: { employee: true, branch: true },
    }),
  ]);

  const stats = {
    scheduled: attendance.length,
    present: attendance.filter((a) => ["ON_TIME", "LATE", "OVERTIME", "EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"].includes(a.status)).length,
    absent: attendance.filter((a) => a.status === "ABSENT").length,
    late: attendance.filter((a) => a.status === "LATE" || a.status === "LATE_AND_EARLY_LEAVE").length,
    missingClockOut: attendance.filter((a) => a.status === "MISSING_CLOCK_OUT").length,
    outsideGeofence: attendance.filter((a) => a.status === "OUTSIDE_GEOFENCE").length,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-success opacity-75"></span>
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-success"></span>
        </span>
        <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
        <span className="text-xs text-muted-foreground">{formatDateTime(new Date())}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: t("scheduled"), value: stats.scheduled },
          { label: t("present"), value: stats.present },
          { label: t("late"), value: stats.late },
          { label: t("absent"), value: stats.absent },
          { label: t("missingOut"), value: stats.missingClockOut },
          { label: t("outsideGeo"), value: stats.outsideGeofence },
        ].map((s) => (
          <Card key={s.label} className="border-border p-3">
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card className="border-border">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">{t("recentPunchesToday")}</div>
        {punches.length === 0 ? <EmptyState title={t("noPunchesToday")} icon={Activity} /> : (
          <div className="max-h-[60vh] overflow-y-auto battend-scroll">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-border bg-card text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">{t("time")}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t("employee")}</th>
                  <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">{t("branch")}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t("action")}</th>
                  <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">{t("source")}</th>
                  <th className="px-4 py-2.5 text-left font-medium">{t("geofence")}</th>
                </tr>
              </thead>
              <tbody>
                {punches.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{new Date(p.timestamp).toLocaleTimeString()}</td>
                    <td className="px-4 py-2.5"><p className="font-medium text-foreground">{employeeDisplayName(p.employee, locale)}</p><p className="text-xs text-muted-foreground">{p.employee?.employeeCode}</p></td>
                    <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">{p.branch?.name ?? "—"}</td>
                    <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{displayPunchType(p.type, locale)}</Badge></td>
                    <td className="hidden px-4 py-2.5 text-xs text-muted-foreground sm:table-cell">{p.source}</td>
                    <td className="px-4 py-2.5">
                      {p.insideGeofence ? (
                        <Badge variant="outline" className="text-xs bg-brand-success/10 text-brand-success border-transparent">{t("inside")}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-transparent">
                          {t("metersAway", { distance: p.distanceMeters ?? 0})}
                        </Badge>
                      )}
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
