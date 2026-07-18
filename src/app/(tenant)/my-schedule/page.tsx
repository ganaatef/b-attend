/** /my-schedule — employee self-service schedule view */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { CalendarClock, Clock, MapPin } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { employeeDisplayName } from "@/lib/employee-display";

export const dynamic = "force-dynamic";

export default async function MySchedulePage() {
  const session = await getSession();
  if (!session?.tenantId) return null;
  const t = await getTranslations("mySchedule");
  const tSchedules = await getTranslations("schedules");
  const locale = await getLocale();

  const user = await db.user.findUnique({ where: { id: session.sub }, include: { employee: { include: { branch: true } } } });
  const employee = user?.employee;

  if (!employee) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <EmptyState title={t("noEmployeeTitle")} description={t("noEmployeeDesc")} icon={CalendarClock} />
      </div>
    );
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [todaySchedule, upcomingSchedules, monthlySchedules] = await Promise.all([
    db.schedule.findUnique({
      where: { companyId_employeeId_date: { companyId: session.tenantId, employeeId: employee.id, date: today } },
      include: { shiftPolicy: true, branch: true },
    }),
    db.schedule.findMany({
      where: { companyId: session.tenantId, employeeId: employee.id, date: { gt: today, lt: weekEnd } },
      include: { shiftPolicy: true, branch: true },
      orderBy: { date: "asc" },
    }),
    db.schedule.findMany({
      where: { companyId: session.tenantId, employeeId: employee.id, date: { gte: new Date(today.getFullYear(), today.getMonth(), 1), lt: monthEnd } },
      include: { shiftPolicy: true },
      orderBy: { date: "asc" },
    }),
  ]);

  function formatTime(d: Date | null) {
    if (!d) return "—";
    return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function calcDuration(start: Date | null, end: Date | null) {
    if (!start || !end) return null;
    const s = new Date(start); const e = new Date(end);
    let mins = Math.round((e.getTime() - s.getTime()) / 60000);
    if (mins <= 0) mins += 24 * 60;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  const dayNames = locale === "ar"
    ? ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{employeeDisplayName(employee, locale)} · {employee.branch?.name ?? t("noBranch")}</p>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">{t("todaysShift")}</CardTitle>
        </CardHeader>
        <CardContent>
          {todaySchedule ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{todaySchedule.shiftPolicy?.name ?? "—"}</span>
                <Badge variant="outline" className="text-xs">{todaySchedule.status}</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatTime(todaySchedule.expectedStart)} → {formatTime(todaySchedule.expectedEnd)}</span>
                {calcDuration(todaySchedule.expectedStart, todaySchedule.expectedEnd) && (
                  <span className="text-xs">({calcDuration(todaySchedule.expectedStart, todaySchedule.expectedEnd)})</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {todaySchedule.branch?.name ?? "—"}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noScheduleToday")}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">{t("upcomingShifts")}</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingSchedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noUpcoming")}</p>
          ) : (
            <div className="space-y-2">
              {upcomingSchedules.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{dayNames[new Date(s.date).getDay()]} {new Date(s.date).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground">{s.shiftPolicy?.name ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{formatTime(s.expectedStart)} → {formatTime(s.expectedEnd)}</p>
                    {calcDuration(s.expectedStart, s.expectedEnd) && (
                      <p className="text-xs text-muted-foreground">({calcDuration(s.expectedStart, s.expectedEnd)})</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">{t("monthlyOverview")}</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlySchedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noMonthlyData")}</p>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {dayNames.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
              {Array.from({ length: monthEnd.getDate() }, (_, i) => {
                const d = new Date(today.getFullYear(), today.getMonth(), i + 1);
                const hasSchedule = monthlySchedules.some((s) => new Date(s.date).getDate() === i + 1);
                const isToday = d.getDate() === today.getDate();
                return (
                  <div key={i} className={`text-center text-xs py-1.5 rounded ${isToday ? "bg-brand-accent text-white font-bold" : hasSchedule ? "bg-brand-accent/10 text-brand-accent" : "text-muted-foreground"}`}>
                    {i + 1}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
