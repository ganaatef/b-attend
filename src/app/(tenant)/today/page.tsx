/** /today — employee dashboard */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Clock, LogIn, LogOut, ClipboardList, CheckSquare, CalendarClock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const session = await getSession();
  if (!session?.tenantId) return null;
  const user = await db.user.findUnique({ where: { id: session.sub }, include: { employee: { include: { branch: true } } } });
  const employee = user?.employee;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  let schedule: any = null, punches: any[] = [], attendanceMonth: any[] = [], pendingRequests: any[] = [];
  if (employee) {
    [schedule, punches, attendanceMonth, pendingRequests] = await Promise.all([
      db.schedule.findUnique({ where: { companyId_employeeId_date: { companyId: session.tenantId, employeeId: employee.id, date: today } }, include: { shiftPolicy: true } }),
      db.punch.findMany({ where: { employeeId: employee.id, timestamp: { gte: today, lt: tomorrow } }, orderBy: { timestamp: "desc" } }),
      db.attendanceDay.findMany({ where: { employeeId: employee.id, date: { gte: monthStart } }, orderBy: { date: "desc" } }),
      db.approvalRequest.findMany({ where: { employeeId: employee.id, status: "PENDING" } }),
    ]);
  }

  if (!employee) {
    return <EmptyState title="No employee record" description="Your user account is not linked to an employee. Contact HR." icon={Clock} />;
  }

  const lastPunch = punches[0];
  const nextAction = !lastPunch || lastPunch.type === "CLOCK_OUT" ? "CLOCK_IN" : "CLOCK_OUT";

  const present = attendanceMonth.filter((a) => ["ON_TIME", "LATE", "OVERTIME", "EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"].includes(a.status)).length;
  const absent = attendanceMonth.filter((a) => a.status === "ABSENT").length;
  const totalLate = attendanceMonth.reduce((s, a) => s + a.lateMinutes, 0);
  const totalWorked = attendanceMonth.reduce((s, a) => s + a.workedMinutes, 0);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent/10 text-xl font-bold text-brand-accent">{employee.fullName.charAt(0).toUpperCase()}</div>
        <h1 className="text-lg font-bold text-foreground">Hi, {employee.fullName.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">{employee.jobTitle ?? ""} · {employee.branch?.name ?? "No branch"}</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          {schedule ? (
            <div className="mt-2">
              <p className="text-sm font-medium text-foreground">Today&apos;s shift: {schedule.shiftPolicy?.name}</p>
              <p className="text-sm text-muted-foreground">
                {schedule.expectedStart ? new Date(schedule.expectedStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} → {schedule.expectedEnd ? new Date(schedule.expectedEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No shift scheduled for today.</p>
          )}
          {lastPunch && (
            <p className="mt-2 text-xs text-muted-foreground">Last action: <span className="font-medium text-foreground">{lastPunch.type.replace(/_/g, " ")}</span> at {new Date(lastPunch.timestamp).toLocaleTimeString()}</p>
          )}
          <Link href="/clock" className="mt-4 block">
            <Button size="lg" className="w-full">
              {nextAction === "CLOCK_IN" ? <><LogIn className="mr-2 h-4 w-4" /> Clock In</> : <><LogOut className="mr-2 h-4 w-4" /> Clock Out</>}
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border p-3"><p className="text-2xl font-bold text-foreground">{present}</p><p className="text-xs text-muted-foreground">Present this month</p></Card>
        <Card className="border-border p-3"><p className="text-2xl font-bold text-foreground">{absent}</p><p className="text-xs text-muted-foreground">Absent this month</p></Card>
        <Card className="border-border p-3"><p className="text-2xl font-bold text-foreground">{totalLate}</p><p className="text-xs text-muted-foreground">Late minutes</p></Card>
        <Card className="border-border p-3"><p className="text-2xl font-bold text-foreground">{Math.floor(totalWorked / 60)}h</p><p className="text-xs text-muted-foreground">Worked hours</p></Card>
      </div>

      {pendingRequests.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/40 p-3">
          <p className="text-sm font-medium text-amber-900">You have {pendingRequests.length} pending request{pendingRequests.length === 1 ? "" : "s"}.</p>
          <Link href="/requests" className="mt-1 inline-block text-xs font-semibold text-amber-700 hover:underline">View requests →</Link>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/attendance" className="rounded-lg border border-border bg-card p-3 text-center hover:bg-muted/40">
          <ClipboardList className="mx-auto h-5 w-5 text-brand-accent" />
          <p className="mt-1 text-xs font-medium text-foreground">My attendance</p>
        </Link>
        <Link href="/requests" className="rounded-lg border border-border bg-card p-3 text-center hover:bg-muted/40">
          <CheckSquare className="mx-auto h-5 w-5 text-brand-accent" />
          <p className="mt-1 text-xs font-medium text-foreground">My requests</p>
        </Link>
      </div>
    </div>
  );
}
