/** /today — employee dashboard */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Clock, LogIn, LogOut, ClipboardList, CheckSquare, CalendarClock, MapPin, CalendarDays } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { employeeDisplayName } from "@/lib/employee-display";
import { displayPunchType } from "@/lib/locale-display";
import { TimeRange, Duration } from "@/components/LtrValue";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const session = await getSession();
  if (!session?.tenantId) return null;
  const t = await getTranslations("today");
  const locale = await getLocale();
  const user = await db.user.findUnique({ where: { id: session.sub }, include: { employee: { include: { branch: true } } } });
  const employee = user?.employee;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);

  let schedule: any = null, punches: any[] = [], attendanceMonth: any[] = [], pendingRequests: any[] = [], nextSchedule: any = null;
  if (employee) {
    [schedule, punches, attendanceMonth, pendingRequests, nextSchedule] = await Promise.all([
      db.schedule.findUnique({ where: { companyId_employeeId_date: { companyId: session.tenantId, employeeId: employee.id, date: today } }, include: { shiftPolicy: true, branch: true } }),
      db.punch.findMany({ where: { employeeId: employee.id, timestamp: { gte: today, lt: tomorrow } }, orderBy: { timestamp: "desc" } }),
      db.attendanceDay.findMany({ where: { employeeId: employee.id, date: { gte: monthStart } }, orderBy: { date: "desc" } }),
      db.approvalRequest.findMany({ where: { employeeId: employee.id, status: "PENDING" } }),
      db.schedule.findFirst({ where: { companyId: session.tenantId, employeeId: employee.id, date: { gt: today, lt: nextWeek } }, include: { shiftPolicy: true, branch: true }, orderBy: { date: "asc" } }),
    ]);
  }

  if (!employee) {
    return <EmptyState title={t("noEmployeeTitle")} description={t("noEmployeeDesc")} icon={Clock} />;
  }

  const lastPunch = punches[0];
  const nextAction = !lastPunch || lastPunch.type === "CLOCK_OUT" ? "CLOCK_IN" : "CLOCK_OUT";

  const present = attendanceMonth.filter((a) => ["ON_TIME", "LATE", "OVERTIME", "EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"].includes(a.status)).length;
  const absent = attendanceMonth.filter((a) => a.status === "ABSENT").length;
  const totalLate = attendanceMonth.reduce((s, a) => s + a.lateMinutes, 0);
  const totalWorked = attendanceMonth.reduce((s, a) => s + a.workedMinutes, 0);

  function formatTime(d: Date | null) {
    if (!d) return "—";
    return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function calcMins(start: Date | null, end: Date | null) {
    if (!start || !end) return 0;
    const s = new Date(start); const e = new Date(end);
    let mins = Math.round((e.getTime() - s.getTime()) / 60000);
    if (mins <= 0) mins += 24 * 60;
    return mins;
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent/10 text-xl font-bold text-brand-accent">{employeeDisplayName(employee, locale).charAt(0).toUpperCase()}</div>
        <h1 className="text-lg font-bold text-foreground">{t("hi", { name: employeeDisplayName(employee, locale).split(" ")[0] })}</h1>
        <p className="text-sm text-muted-foreground">{employee.jobTitle ?? ""} · {employee.branch?.name ?? t("noBranch")}</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          {schedule ? (
            <div className="mt-2 space-y-1">
              <p className="text-sm font-medium text-foreground">{t("todaysShift", { shift: schedule.shiftPolicy?.name ?? "" })}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <TimeRange start={formatTime(schedule.expectedStart)} end={formatTime(schedule.expectedEnd)} />
                {calcMins(schedule.expectedStart, schedule.expectedEnd) > 0 && (
                  <span className="text-xs">(<Duration minutes={calcMins(schedule.expectedStart, schedule.expectedEnd)} locale={locale} />)</span>
                )}
              </div>
              {schedule.branch && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {schedule.branch.name}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{t("noSchedule")}</p>
          )}
          {nextSchedule && (
            <div className="mt-2 rounded-md bg-muted/30 px-3 py-2">
              <p className="text-xs font-medium text-foreground">{t("nextShift")}: {nextSchedule.shiftPolicy?.name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{new Date(nextSchedule.date).toLocaleDateString()} · <TimeRange start={formatTime(nextSchedule.expectedStart)} end={formatTime(nextSchedule.expectedEnd)} /></p>
            </div>
          )}
          {lastPunch && (
            <p className="mt-2 text-xs text-muted-foreground">{t("lastActionAt", { action: displayPunchType(lastPunch.type, locale), time: new Date(lastPunch.timestamp).toLocaleTimeString() })}</p>
          )}
          <Link href="/clock" className="mt-4 block">
            <Button size="lg" className="w-full">
              {nextAction === "CLOCK_IN" ? <><LogIn className="mr-2 h-4 w-4" /> {t("clockIn")}</> : <><LogOut className="mr-2 h-4 w-4" /> {t("clockOut")}</>}
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border p-3"><p className="text-2xl font-bold text-foreground">{present}</p><p className="text-xs text-muted-foreground">{t("presentMonth")}</p></Card>
        <Card className="border-border p-3"><p className="text-2xl font-bold text-foreground">{absent}</p><p className="text-xs text-muted-foreground">{t("absentMonth")}</p></Card>
        <Card className="border-border p-3"><p className="text-2xl font-bold text-foreground">{totalLate}</p><p className="text-xs text-muted-foreground">{t("lateMinutesStat")}</p></Card>
        <Card className="border-border p-3"><p className="text-2xl font-bold text-foreground">{Math.floor(totalWorked / 60)}h</p><p className="text-xs text-muted-foreground">{t("workedHoursStat")}</p></Card>
      </div>

      {pendingRequests.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/40 p-3">
          <p className="text-sm font-medium text-amber-900">{t("pendingRequests", { count: pendingRequests.length })}</p>
          <Link href="/requests" className="mt-1 inline-block text-xs font-semibold text-amber-700 hover:underline">{t("viewRequests")}</Link>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Link href="/my-schedule" className="rounded-lg border border-border bg-card p-3 text-center hover:bg-muted/40">
          <CalendarDays className="mx-auto h-5 w-5 text-brand-accent" />
          <p className="mt-1 text-xs font-medium text-foreground">{t("mySchedule")}</p>
        </Link>
        <Link href="/attendance" className="rounded-lg border border-border bg-card p-3 text-center hover:bg-muted/40">
          <ClipboardList className="mx-auto h-5 w-5 text-brand-accent" />
          <p className="mt-1 text-xs font-medium text-foreground">{t("myAttendance")}</p>
        </Link>
        <Link href="/requests" className="rounded-lg border border-border bg-card p-3 text-center hover:bg-muted/40">
          <CheckSquare className="mx-auto h-5 w-5 text-brand-accent" />
          <p className="mt-1 text-xs font-medium text-foreground">{t("myRequests")}</p>
        </Link>
      </div>
    </div>
  );
}
