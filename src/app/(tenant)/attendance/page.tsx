/** /attendance — employee's own attendance history */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { ClipboardList } from "lucide-react";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const session = await getSession();
  if (!session?.tenantId) return null;
  const t = await getTranslations("attendance");
  const user = await db.user.findUnique({ where: { id: session.sub }, include: { employee: true } });
  const employee = user?.employee;
  if (!employee) return <EmptyState title={t("noEmployeeTitle")} icon={ClipboardList} />;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const days = await db.attendanceDay.findMany({
    where: { employeeId: employee.id, date: { gte: monthStart } },
    orderBy: { date: "desc" },
  });

  const stats = {
    present: days.filter((d) => ["ON_TIME", "LATE", "OVERTIME", "EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"].includes(d.status)).length,
    absent: days.filter((d) => d.status === "ABSENT").length,
    late: days.filter((d) => d.status === "LATE" || d.status === "LATE_AND_EARLY_LEAVE").length,
    overtime: days.filter((d) => d.overtimeMinutes > 0).length,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div><h1 className="text-lg font-bold text-foreground">{t("myAttendance")}</h1><p className="text-sm text-muted-foreground">{employee.fullName} · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border p-3"><p className="text-2xl font-bold text-foreground">{stats.present}</p><p className="text-xs text-muted-foreground">{t("present")}</p></Card>
        <Card className="border-border p-3"><p className="text-2xl font-bold text-foreground">{stats.absent}</p><p className="text-xs text-muted-foreground">{t("absent")}</p></Card>
        <Card className="border-border p-3"><p className="text-2xl font-bold text-foreground">{stats.late}</p><p className="text-xs text-muted-foreground">{t("lateDays")}</p></Card>
        <Card className="border-border p-3"><p className="text-2xl font-bold text-foreground">{stats.overtime}</p><p className="text-xs text-muted-foreground">{t("overtimeDays")}</p></Card>
      </div>
      <Card className="border-border">
        {days.length === 0 ? <EmptyState title={t("noAttendanceYet")} icon={ClipboardList} /> : (
          <div className="divide-y divide-border/60">
            {days.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{new Date(d.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.actualClockIn ? new Date(d.actualClockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} → {d.actualClockOut ? new Date(d.actualClockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                    {" · "}{Math.floor(d.workedMinutes / 60)}h {d.workedMinutes % 60}m
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">{d.status.replace(/_/g, " ")}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
