/** /dashboard — customer owner/HR/manager operational dashboard */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getPermissionAccessScopes, type PermissionAccessScopes } from "@/lib/auth/authorization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionBadge } from "@/components/badges/StatusBadges";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Users, Building2, CalendarClock, CheckCircle2, AlertCircle, Clock, FileBarChart } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { employeeDisplayName } from "@/lib/employee-display";

export const dynamic = "force-dynamic";

function hasAnyScope(scopes: PermissionAccessScopes) {
  return scopes.tenant || scopes.self || scopes.branchIds.length > 0 || scopes.departmentIds.length > 0;
}

function employeeScopeFilter(scopes: PermissionAccessScopes, userId: string): any {
  if (scopes.tenant) return {};
  const or: any[] = [];
  if (scopes.branchIds.length > 0) or.push({ branchId: { in: scopes.branchIds } });
  if (scopes.departmentIds.length > 0) or.push({ departmentId: { in: scopes.departmentIds } });
  if (scopes.self) or.push({ userId });
  return or.length > 0 ? { OR: or } : { id: "__no_access__" };
}

function employeeRelationScopeFilter(scopes: PermissionAccessScopes, userId: string): any {
  if (scopes.tenant) return {};
  const or: any[] = [];
  if (scopes.branchIds.length > 0) or.push({ branchId: { in: scopes.branchIds } });
  if (scopes.departmentIds.length > 0) or.push({ employee: { departmentId: { in: scopes.departmentIds } } });
  if (scopes.self) or.push({ employee: { userId } });
  return or.length > 0 ? { OR: or } : { id: "__no_access__" };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  const tid = session.tenantId;

  const t = await getTranslations("dashboard");
  const tSub = await getTranslations("subscription");
  const locale = await getLocale();

  const [employeeScopes, scheduleScopes, attendanceScopes, approvalScopes] = await Promise.all([
    getPermissionAccessScopes({ companyId: tid, userId: session.sub, legacyRole: session.role, permission: "employees.view" }),
    getPermissionAccessScopes({ companyId: tid, userId: session.sub, legacyRole: session.role, permission: "schedules.team.view" }),
    getPermissionAccessScopes({ companyId: tid, userId: session.sub, legacyRole: session.role, permission: "attendance.team.view" }),
    getPermissionAccessScopes({ companyId: tid, userId: session.sub, legacyRole: session.role, permission: "attendance.approve" }),
  ]);

  // Employee self-service identities do not receive this managerial dashboard.
  if (![employeeScopes, scheduleScopes, attendanceScopes, approvalScopes].some(hasAnyScope)) return null;

  const employeeFilter = employeeScopeFilter(employeeScopes, session.sub);
  const scheduleFilter = employeeRelationScopeFilter(scheduleScopes, session.sub);
  const attendanceFilter = employeeRelationScopeFilter(attendanceScopes, session.sub);
  const approvalFilter = employeeRelationScopeFilter(approvalScopes, session.sub);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    employees, visibleEmployees, policies, schedulesToday, punchesToday,
    pendingApprovals, recentExceptions, tenant, subscription, currentUser,
  ] = await Promise.all([
    db.employee.count({ where: { companyId: tid, deletedAt: null, status: "ACTIVE", ...employeeFilter } }),
    db.employee.findMany({
      where: { companyId: tid, deletedAt: null, status: "ACTIVE", ...employeeFilter },
      select: { branchId: true, departmentId: true },
    }),
    db.shiftPolicy.count({ where: { companyId: tid } }),
    db.schedule.count({ where: { companyId: tid, date: { gte: today, lt: tomorrow }, ...scheduleFilter } }),
    db.punch.count({ where: { companyId: tid, timestamp: { gte: today, lt: tomorrow }, ...attendanceFilter } }),
    db.approvalRequest.count({ where: { companyId: tid, status: "PENDING", ...approvalFilter } }),
    db.punch.findMany({
      where: {
        companyId: tid,
        timestamp: { gte: today, lt: tomorrow },
        status: "NEEDS_APPROVAL",
        ...attendanceFilter,
      },
      include: { employee: true, branch: true },
      take: 5,
      orderBy: { timestamp: "desc" },
    }),
    db.tenant.findUnique({ where: { id: tid } }),
    db.subscription.findUnique({ where: { tenantId: tid }, include: { plan: true } }),
    db.user.findUnique({ where: { id: session.sub } }),
  ]);

  const branches = new Set(visibleEmployees.map((employee) => employee.branchId).filter(Boolean)).size;
  const departments = new Set(visibleEmployees.map((employee) => employee.departmentId).filter(Boolean)).size;
  const displayName = locale === "ar" ? (currentUser?.name || session.name) : session.name;

  const cards = [
    { label: t("activeEmployees"), value: employees, icon: Users, sub: `${branches} ${t("branches")} · ${departments} ${t("depts")}` },
    { label: t("scheduledToday"), value: schedulesToday, icon: CalendarClock, sub: `${policies} ${t("shiftPolicies")}` },
    { label: t("clockActionsToday"), value: punchesToday, icon: Clock, sub: t("punchesRecorded") },
    { label: t("pendingApprovals"), value: pendingApprovals, icon: AlertCircle, sub: t("awaitingReview"), highlight: pendingApprovals > 0 },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">{t("welcome", { name: displayName })}</h1>
        <p className="text-sm text-muted-foreground">{locale === "ar" ? (tenant?.nameAr || tenant?.name) : tenant?.name} · {locale === "ar" ? (subscription?.plan.nameAr || subscription?.plan.name) : subscription?.plan.name} {t("plan")} {subscription && <SubscriptionBadge status={subscription.status} />}</p>
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
                    <span className="text-xs text-amber-700">
                      {p.insideGeofence
                        ? (locale === "ar" ? "يحتاج مراجعة الثقة" : "Trust review")
                        : `${p.distanceMeters ?? 0}m`}
                    </span>
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
