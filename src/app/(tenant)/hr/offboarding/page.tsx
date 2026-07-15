import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { hasHrPermission, getManagedBranchIds } from "@/lib/hr/permissions";
import { startOffboardingAction } from "../actions";
import { UserMinus, CheckCircle2, Clock, ArrowRightLeft, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OffboardingPage() {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const tid = session.tenantId;

  const featureCheck = await canUseHrFeature(tid, "hr_core");
  if (!featureCheck.allowed) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Card className="border-dashed border-amber-300 bg-amber-50/40">
          <div className="pt-6 pb-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-amber-500" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">HR Module requires Starter plan or higher</h3>
            <p className="mt-1 text-xs text-muted-foreground">{featureCheck.reason ?? "Upgrade to access HR features."}</p>
          </div>
        </Card>
      </div>
    );
  }

  const canManage = await hasHrPermission("MANAGE_OFFBOARDING");
  const isBranchManager = session.role === "BRANCH_MANAGER";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, tid) : [];

  const branchFilter = isBranchManager && managedBranchIds.length > 0
    ? { employee: { branchId: { in: managedBranchIds } } }
    : {};

  const taskWhere = { companyId: tid, ...branchFilter };

  const [employeesWithOffboarding, pendingCount, completedCount, finalizedCount, eligibleEmployees] = await Promise.all([
    db.employee.findMany({
      where: {
        companyId: tid,
        deletedAt: null,
        offboardingTasks: { some: {} },
        ...(isBranchManager && managedBranchIds.length > 0 ? { branchId: { in: managedBranchIds } } : {}),
      },
      include: {
        branch: { select: { name: true } },
        department: { select: { name: true } },
        offboardingTasks: true,
      },
      orderBy: { fullName: "asc" },
    }),
    db.offboardingTask.count({ where: { ...taskWhere, status: { in: ["PENDING", "IN_PROGRESS"] } } }),
    db.offboardingTask.count({ where: { ...taskWhere, status: "COMPLETED" } }),
    db.employee.count({
      where: {
        companyId: tid,
        deletedAt: null,
        status: "LEFT",
        offboardingTasks: { some: {} },
        ...(isBranchManager && managedBranchIds.length > 0 ? { branchId: { in: managedBranchIds } } : {}),
      },
    }),
    canManage
      ? db.employee.findMany({
          where: {
            companyId: tid,
            deletedAt: null,
            status: "ACTIVE",
            offboardingTasks: { none: {} },
            ...(isBranchManager && managedBranchIds.length > 0 ? { branchId: { in: managedBranchIds } } : {}),
          },
          select: { id: true, fullName: true, employeeCode: true },
          orderBy: { fullName: "asc" },
        })
      : [],
  ]);

  const totalEmployees = employeesWithOffboarding.length;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <Link href="/hr" className="text-xs text-muted-foreground hover:text-foreground">&larr; HR Dashboard</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">Offboarding</h1>
        <p className="text-sm text-muted-foreground">{totalEmployees} employees in offboarding</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{totalEmployees}</p>
          <p className="text-xs text-muted-foreground">Employees in offboarding</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">Tasks pending</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{completedCount}</p>
          <p className="text-xs text-muted-foreground">Tasks completed</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{finalizedCount}</p>
          <p className="text-xs text-muted-foreground">Employees finalized</p>
        </Card>
      </div>

      {canManage && eligibleEmployees.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Start Offboarding</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={async (formData: FormData) => { "use server"; await startOffboardingAction({}, formData); }} className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="offboard-emp" className="sr-only">Employee</Label>
                <select name="employeeId" id="offboard-emp" required className="flex h-8 w-full rounded-md border border-border bg-card px-2 text-xs text-foreground">
                  <option value="">Select employee...</option>
                  {eligibleEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.employeeCode})</option>
                  ))}
                </select>
              </div>
              <div className="w-40">
                <Label htmlFor="offboard-day" className="sr-only">Last working day</Label>
                <input id="offboard-day" name="lastWorkingDay" type="date" required className="flex h-8 w-full rounded-md border border-border bg-card px-2 text-xs text-foreground" />
              </div>
              <Button type="submit" size="sm" className="h-8">Start</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Employees</CardTitle>
        </CardHeader>
        <CardContent>
          {employeesWithOffboarding.length === 0 ? (
            <EmptyState title="No employees in offboarding" icon={UserMinus} />
          ) : (
            <div className="divide-y divide-border/60">
              {employeesWithOffboarding.map((emp) => {
                const total = emp.offboardingTasks.length;
                const done = emp.offboardingTasks.filter((t) => t.status === "COMPLETED").length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                return (
                  <Link key={emp.id} href={`/hr/offboarding/${emp.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        <UserMinus className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{emp.fullName} <span className="text-xs text-muted-foreground">({emp.employeeCode})</span></p>
                          <Badge variant={emp.status === "LEFT" ? "default" : "outline"} className={`text-[10px] ${emp.status === "LEFT" ? "bg-brand-success text-white border-transparent" : ""}`}>{emp.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{emp.branch?.name ?? "—"} &middot; {emp.department?.name ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs font-medium text-foreground">{done}/{total} tasks</p>
                        <div className="mt-1 h-1.5 w-24 rounded-full bg-muted">
                          <div className="h-full rounded-full bg-brand-accent" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
