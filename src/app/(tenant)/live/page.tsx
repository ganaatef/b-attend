/** /live — Live attendance feed for today. */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getPermissionAccessScopes } from "@/lib/auth/authorization";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Activity } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { getTranslations, getLocale } from "next-intl/server";
import { employeeDisplayName } from "@/lib/employee-display";
import { displayPunchType } from "@/lib/locale-display";

export const dynamic = "force-dynamic";

type StoredTrust = {
  score: number;
  riskLevel: string;
  decision: string;
};

function parseStoredTrust(deviceInfo: string | null): StoredTrust | null {
  if (!deviceInfo) return null;
  try {
    const value = JSON.parse(deviceInfo) as { trust?: Partial<StoredTrust> };
    if (!value.trust || typeof value.trust.score !== "number") return null;
    return {
      score: value.trust.score,
      riskLevel: String(value.trust.riskLevel ?? "UNKNOWN"),
      decision: String(value.trust.decision ?? "UNKNOWN"),
    };
  } catch {
    return null;
  }
}

function trustRiskLabel(riskLevel: string, isArabic: boolean) {
  if (!isArabic) return riskLevel;
  if (riskLevel === "LOW") return "منخفض";
  if (riskLevel === "MEDIUM") return "متوسط";
  if (riskLevel === "HIGH") return "مرتفع";
  if (riskLevel === "CRITICAL") return "حرج";
  return "غير متاح";
}

function trustBadgeClass(riskLevel: string) {
  if (riskLevel === "LOW") return "bg-brand-success/10 text-brand-success border-transparent";
  if (riskLevel === "MEDIUM") return "bg-amber-100 text-amber-800 border-transparent";
  if (riskLevel === "HIGH") return "bg-orange-100 text-orange-800 border-transparent";
  if (riskLevel === "CRITICAL") return "bg-destructive/10 text-destructive border-transparent";
  return "";
}

export default async function LivePage() {
  const t = await getTranslations("live");
  const locale = await getLocale();
  const isArabic = locale === "ar";
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;

  // Resolve the exact dataset scopes for this permission. This supports custom
  // roles and Branch/Department/Self IAM assignments without ever loading the
  // full tenant dataset and filtering it in the browser.
  const scopes = await getPermissionAccessScopes({
    companyId: session.tenantId,
    userId: session.sub,
    legacyRole: session.role,
    permission: "attendance.team.view",
  });

  const scopedOr: any[] = [];
  if (scopes.branchIds.length > 0) scopedOr.push({ branchId: { in: scopes.branchIds } });
  if (scopes.departmentIds.length > 0) scopedOr.push({ employee: { departmentId: { in: scopes.departmentIds } } });
  if (scopes.self) scopedOr.push({ employee: { userId: session.sub } });
  if (!scopes.tenant && scopedOr.length === 0) return null;
  const accessFilter: any = scopes.tenant ? {} : { OR: scopedOr };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const [punches, attendance] = await Promise.all([
    db.punch.findMany({
      where: { companyId: session.tenantId, timestamp: { gte: today, lt: tomorrow }, ...accessFilter },
      include: { employee: true, branch: true },
      orderBy: { timestamp: "desc" },
      take: 100,
    }),
    db.attendanceDay.findMany({
      where: { companyId: session.tenantId, date: today, ...accessFilter },
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
                  <th className="px-4 py-2.5 text-left font-medium">{isArabic ? "الثقة" : "Trust"}</th>
                </tr>
              </thead>
              <tbody>
                {punches.map((p) => {
                  const trust = parseStoredTrust(p.deviceInfo);
                  return (
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
                      <td className="px-4 py-2.5">
                        {trust ? (
                          <Badge variant="outline" className={`text-xs ${trustBadgeClass(trust.riskLevel)}`} title={trust.decision}>
                            <bdi dir="ltr">{trust.score}/100</bdi> · {trustRiskLabel(trust.riskLevel, isArabic)}
                          </Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
