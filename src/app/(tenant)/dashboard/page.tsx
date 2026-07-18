/** /dashboard — customer owner/HR dashboard */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionBadge } from "@/components/badges/StatusBadges";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Users, Building2, CalendarClock, CheckCircle2, AlertCircle, Clock, FileBarChart } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { employeeDisplayName } from "@/lib/employee-display";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const tid = session.tenantId;

  const t = await getTranslations("dashboard");
  const tSub = await getTranslations("subscription");
  const locale = await getLocale();

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    employees, branches, departments, policies, schedulesToday, punchesToday,
    pendingApprovals, recentExceptions, tenant, subscription,
  ] = await Promise.all([
    db.employee.count({ where: { companyId: tid, deletedAt: null, status: "ACTIVE" } }),
    db.branch.count({ where: { companyId: tid, deletedAt: null } }),
    db.department.count({ where: { companyId: tid } }),
    db.shiftPolicy.count({ where: { companyId: tid } }),
    db.schedule.count({ where: { companyId: tid, date: { gte: today, lt: tomorrow } } }),
    db.punch.count({ where: { companyId: tid, timestamp: { gte: today } } }),
    db.approvalRequest.count({ where: { companyId: tid, status: "PENDING" } }),
    db.punch.findMany({ where: { companyId: tid, insideGeofence: false }, include: { employee: true, branch: true }, take: 5, orderBy: { timestamp: "desc" } }),
    db.tenant.findUnique({ where: { id: tid } }),
    db.subscription.findUnique({ where: { tenantId: tid }, include: { plan: true } }),
  ]);

  const cards = [
    { label: t("activeEmployees"), value: employees, icon: Users, sub: `${branches} ${t("branches")} · ${departments} ${t("depts")}` },
    { label: t("scheduledToday"), value: schedulesToday, icon: CalendarClock, sub: `${policies} ${t("shiftPolicies")}` },
    { label: t("clockActionsToday"), value: punchesToday, icon: Clock, sub: t("punchesRecorded") },
    { label: t("pendingApprovals"), value: pendingApprovals, icon: AlertCircle, sub: t("awaitingReview"), highlight: pendingApprovals > 0 },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">{t("welcome", { name: session.name })}</h1>
        <p className="text-sm text-muted-foreground">{tenant?.name} · {subscription?.plan.name} {t("plan")} {subscription && <SubscriptionBadge status={subscription.status} />}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className={c.highlight ? "border-amber-300 bg-amber-50/40" : "border-border"}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">{c.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground">{t("recentExceptions")}</CardTitle>
              <Link href="/live" className="text-xs text-brand-accent hover:underline">{t("liveAttendance")}</Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentExceptions.length === 0 ? (
              <EmptyState title={t("noExceptions")} icon={CheckCircle2} />
            ) : (
              <div className="space-y-2">
                {recentExceptions.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{employeeDisplayName(p.employee, locale)}</p>
                      <p className="text-xs text-muted-foreground">{p.branch?.name}</p>
                    </div>
                    <span className="text-xs text-amber-700">{p.distanceMeters}m</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("quickLinks")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Link href="/live" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <Building2 className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">{t("liveAtt")}</p>
            </Link>
            <Link href="/employees" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <Users className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">{t("employees")}</p>
            </Link>
            <Link href="/schedules" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <CalendarClock className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">{t("schedules")}</p>
            </Link>
            <Link href="/reports" className="rounded-md border border-border bg-card p-3 text-sm hover:bg-muted/40">
              <FileBarChart className="h-4 w-4 text-brand-accent" />
              <p className="mt-1 font-medium text-foreground">{t("reports")}</p>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
