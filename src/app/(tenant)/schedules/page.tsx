/** /schedules */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { CalendarClock, Plus } from "lucide-react";
import { ScheduleForm } from "./ScheduleForm";

export const dynamic = "force-dynamic";

export default async function SchedulesPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const session = await getSession();
  if (!session?.tenantId) return null;
  const params = await searchParams;
  const date = params.date ? new Date(params.date) : new Date();
  date.setHours(0, 0, 0, 0);
  const next = new Date(date); next.setDate(next.getDate() + 1);

  const [schedules, branches, employees, policies] = await Promise.all([
    db.schedule.findMany({
      where: { companyId: session.tenantId, date: { gte: date, lt: next } },
      include: { employee: true, branch: true, shiftPolicy: true },
      orderBy: { expectedStart: "asc" },
    }),
    db.branch.findMany({ where: { companyId: session.tenantId, deletedAt: null } }),
    db.employee.findMany({ where: { companyId: session.tenantId, deletedAt: null }, orderBy: { fullName: "asc" } }),
    db.shiftPolicy.findMany({ where: { companyId: session.tenantId } }),
  ]);

  const dayStr = date.toISOString().split("T")[0];
  const prevDate = new Date(date); prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(date); nextDate.setDate(nextDate.getDate() + 1);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-lg font-bold text-foreground">Schedules</h1><p className="text-sm text-muted-foreground">{schedules.length} schedules for {new Date(date).toLocaleDateString()}.</p></div>
        <Link href="/schedules/bulk" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="h-3.5 w-3.5" /> Bulk generate</Link>
      </div>
      <div className="flex items-center gap-2">
        <Link href={`/schedules?date=${prevDate.toISOString().split("T")[0]}`} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted">← Previous day</Link>
        <input type="date" defaultValue={dayStr} onChange={(e) => window.location.href = `/schedules?date=${e.target.value}`} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs" />
        <Link href={`/schedules?date=${nextDate.toISOString().split("T")[0]}`} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted">Next day →</Link>
      </div>
      <Card className="border-border p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Add single schedule</h2>
        <ScheduleForm branches={branches} employees={employees} policies={policies} />
      </Card>
      <Card className="border-border">
        {schedules.length === 0 ? <EmptyState title="No schedules for this day" icon={CalendarClock} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Employee</th>
                  <th className="px-4 py-3 text-left font-medium">Branch</th>
                  <th className="px-4 py-3 text-left font-medium">Shift</th>
                  <th className="px-4 py-3 text-left font-medium">Expected</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3"><Link href={`/employees/${s.employeeId}`} className="font-medium text-foreground hover:text-brand-accent">{s.employee?.fullName}</Link><p className="text-xs text-muted-foreground">{s.employee?.employeeCode}</p></td>
                    <td className="px-4 py-3 text-muted-foreground">{s.branch?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.shiftPolicy?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.expectedStart ? new Date(s.expectedStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} → {s.expectedEnd ? new Date(s.expectedEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{s.status}</Badge></td>
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
