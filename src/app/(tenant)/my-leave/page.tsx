/** /my-leave — Employee self-service leave */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { MyLeaveClient } from "./MyLeaveClient";
import { CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MyLeavePage() {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;

  const tid = session.tenantId;

  const user = await db.user.findUnique({ where: { id: session.sub }, include: { employee: true } });
  const employee = user?.employee;

  if (!employee) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">My Leave</h1>
          <p className="text-sm text-muted-foreground">View your leave balances and submit requests.</p>
        </div>
        <Card>
          <CardContent className="py-6">
            <p className="text-center text-sm text-muted-foreground">Your user is not linked to an employee record. Contact HR.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const employeeId = employee.id;
  const currentYear = new Date().getFullYear();

  const [leaveTypes, leaveBalances, leaveRequests] = await Promise.all([
    db.leaveType.findMany({ where: { companyId: tid, active: true }, orderBy: { name: "asc" } }),
    db.leaveBalance.findMany({ where: { employeeId, year: currentYear }, include: { leaveType: true } }),
    db.leaveRequest.findMany({
      where: { employeeId },
      include: { leaveType: { select: { name: true, code: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const requestStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED": return "bg-brand-success text-white border-transparent";
      case "REJECTED": return "bg-destructive/10 text-destructive border-destructive/20";
      case "PENDING": return "bg-amber-50 text-amber-600 border-amber-200";
      case "CANCELLED": return "bg-muted text-muted-foreground border-border";
      default: return "";
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">My Leave</h1>
        <p className="text-sm text-muted-foreground">View your leave balances and submit requests.</p>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Leave Balances ({currentYear})</CardTitle>
        </CardHeader>
        <CardContent>
          {leaveBalances.length === 0 ? (
            <EmptyState title="No leave balances" icon={CalendarDays} />
          ) : (
            <div className="divide-y divide-border/60">
              {leaveBalances.map((lb) => (
                <div key={lb.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">{lb.leaveType.name}</p>
                    <p className="text-xs text-muted-foreground">{lb.leaveType.code}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-medium text-foreground">{lb.remaining}/{lb.openingBalance + lb.accrued} remaining</p>
                    <p className="text-muted-foreground">Used: {lb.used} · Pending: {lb.pending}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <MyLeaveClient leaveTypes={leaveTypes} leaveRequests={leaveRequests} requestStatusColor={requestStatusColor} />

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">My Leave Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {leaveRequests.length === 0 ? (
            <EmptyState title="No leave requests yet" icon={CalendarDays} />
          ) : (
            <div className="divide-y divide-border/60">
              {leaveRequests.map((lr) => (
                <div key={lr.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{lr.leaveType.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(lr.startDate).toLocaleDateString()} — {new Date(lr.endDate).toLocaleDateString()} · {lr.daysCount} day{lr.daysCount > 1 ? "s" : ""}
                      </p>
                      {lr.reason && <p className="text-[10px] text-muted-foreground truncate max-w-[300px]">{lr.reason}</p>}
                    </div>
                  </div>
                  <Badge variant={lr.status === "APPROVED" ? "default" : "outline"} className={`text-[10px] ${requestStatusColor(lr.status)}`}>{lr.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
