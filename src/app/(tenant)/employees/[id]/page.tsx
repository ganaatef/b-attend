/** /employees/[id] */
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { User as UserIcon, Clock, ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.tenantId) return null;
  const { id } = await params;
  const employee = await db.employee.findFirst({
    where: { id, companyId: session.tenantId, deletedAt: null },
    include: { branch: true, department: true, defaultShiftPolicy: true, user: true },
  });
  if (!employee) notFound();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [attendanceDays, punches, requests] = await Promise.all([
    db.attendanceDay.findMany({ where: { employeeId: id, date: { gte: monthStart } }, orderBy: { date: "desc" }, take: 31 }),
    db.punch.findMany({ where: { employeeId: id }, orderBy: { timestamp: "desc" }, take: 20 }),
    db.approvalRequest.findMany({ where: { employeeId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const present = attendanceDays.filter((a) => ["ON_TIME", "LATE", "OVERTIME", "EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"].includes(a.status)).length;
  const absent = attendanceDays.filter((a) => a.status === "ABSENT").length;
  const totalLate = attendanceDays.reduce((s, a) => s + a.lateMinutes, 0);
  const totalWorked = attendanceDays.reduce((s, a) => s + a.workedMinutes, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <Link href="/employees" className="text-xs text-muted-foreground hover:text-foreground">← Employees</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">{employee.fullName}</h1>
        <p className="text-sm text-muted-foreground">{employee.employeeCode} · {employee.jobTitle ?? "—"}</p>
        <div className="mt-2 flex items-center gap-2"><Badge variant={employee.status === "ACTIVE" ? "default" : "destructive"} className={employee.status === "ACTIVE" ? "bg-brand-success text-white border-transparent" : ""}>{employee.status}</Badge><Badge variant="outline">{employee.employmentType.replace(/_/g, " ")}</Badge></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Branch</p><p className="text-sm font-semibold text-foreground">{employee.branch?.name ?? "—"}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Department</p><p className="text-sm font-semibold text-foreground">{employee.department?.name ?? "—"}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm font-semibold text-foreground">{employee.phone ?? "—"}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Email</p><p className="text-sm font-semibold text-foreground truncate">{employee.email ?? "—"}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">This month summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><p className="text-2xl font-bold text-foreground">{present}</p><p className="text-xs text-muted-foreground">Present days</p></div>
            <div><p className="text-2xl font-bold text-foreground">{absent}</p><p className="text-xs text-muted-foreground">Absent days</p></div>
            <div><p className="text-2xl font-bold text-foreground">{totalLate}</p><p className="text-xs text-muted-foreground">Late minutes</p></div>
            <div><p className="text-2xl font-bold text-foreground">{Math.floor(totalWorked / 60)}h</p><p className="text-xs text-muted-foreground">Worked hours</p></div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Recent punches</CardTitle></CardHeader>
        <CardContent>
          {punches.length === 0 ? <EmptyState title="No punches yet" icon={Clock} /> : (
            <div className="max-h-72 space-y-1.5 overflow-y-auto battend-scroll">
              {punches.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                  <div><p className="font-medium text-foreground">{p.type.replace(/_/g, " ")}</p><p className="text-muted-foreground">{new Date(p.timestamp).toLocaleString()}</p></div>
                  <div className="text-right"><p className="text-muted-foreground">{p.source}</p><p className="text-muted-foreground">{p.insideGeofence ? "In geofence" : "Outside"}</p></div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Recent requests</CardTitle></CardHeader>
        <CardContent>
          {requests.length === 0 ? <EmptyState title="No requests" icon={ClipboardList} /> : (
            <div className="space-y-1.5">
              {requests.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                  <div><p className="font-medium text-foreground">{r.type.replace(/_/g, " ")}</p><p className="text-muted-foreground">{r.reason}</p></div>
                  <Badge variant="outline">{r.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
