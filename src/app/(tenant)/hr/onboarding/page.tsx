import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { hasHrPermission, getManagedBranchIds } from "@/lib/hr/permissions";
import { createDefaultOnboardingChecklistAction } from "../actions";
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE" || session.role === "BRANCH_MANAGER") return null;
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

  const canManage = await hasHrPermission("MANAGE_ONBOARDING");
  const isBranchManager = session.role === "BRANCH_MANAGER";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, tid) : [];

  const branchFilter = isBranchManager && managedBranchIds.length > 0
    ? { employee: { branchId: { in: managedBranchIds } } }
    : {};

  const taskWhere = { companyId: tid, ...branchFilter };

  const [employeesWithOnboarding, pendingCount, completedCount, overdueCount, allEmployees] = await Promise.all([
    db.employee.findMany({
      where: {
        companyId: tid,
        deletedAt: null,
        onboardingTasks: { some: {} },
        ...(isBranchManager && managedBranchIds.length > 0 ? { branchId: { in: managedBranchIds } } : {}),
      },
      include: {
        branch: { select: { name: true } },
        department: { select: { name: true } },
        onboardingTasks: true,
      },
      orderBy: { fullName: "asc" },
    }),
    db.onboardingTask.count({ where: { ...taskWhere, status: { in: ["PENDING", "IN_PROGRESS"] } } }),
    db.onboardingTask.count({ where: { ...taskWhere, status: "COMPLETED" } }),
    db.onboardingTask.count({ where: { ...taskWhere, status: { in: ["PENDING", "IN_PROGRESS"] }, dueDate: { lt: new Date(), not: null } } }),
    canManage
      ? db.employee.findMany({
          where: {
            companyId: tid,
            deletedAt: null,
            onboardingTasks: { none: {} },
            ...(isBranchManager && managedBranchIds.length > 0 ? { branchId: { in: managedBranchIds } } : {}),
          },
          select: { id: true, fullName: true, employeeCode: true },
          orderBy: { fullName: "asc" },
        })
      : [],
  ]);

  const totalEmployees = employeesWithOnboarding.length;

  const taskStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "outline";
      case "IN_PROGRESS": return "outline";
      case "COMPLETED": return "default";
      case "CANCELLED": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <Link href="/hr" className="text-xs text-muted-foreground hover:text-foreground">&larr; HR Dashboard</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">Onboarding</h1>
        <p className="text-sm text-muted-foreground">{totalEmployees} employees with onboarding tasks</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{totalEmployees}</p>
          <p className="text-xs text-muted-foreground">Employees in onboarding</p>
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
          <p className="text-2xl font-bold text-foreground">{overdueCount}</p>
          <p className="text-xs text-muted-foreground">Tasks overdue</p>
        </Card>
      </div>

      {canManage && allEmployees.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Create Default Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={async (formData: FormData) => { "use server"; await createDefaultOnboardingChecklistAction(formData.get("employeeId") as string); }} className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="emp-select" className="sr-only">Employee</Label>
                <select name="employeeId" id="emp-select" required className="flex h-8 w-full rounded-md border border-border bg-card px-2 text-xs text-foreground">
                  <option value="">Select employee...</option>
                  {allEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.employeeCode})</option>
                  ))}
                </select>
              </div>
              <Button type="submit" size="sm" className="h-8">Create</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Employees</CardTitle>
        </CardHeader>
        <CardContent>
          {employeesWithOnboarding.length === 0 ? (
            <EmptyState title="No employees in onboarding" icon={ClipboardList} />
          ) : (
            <div className="divide-y divide-border/60">
              {employeesWithOnboarding.map((emp) => {
                const total = emp.onboardingTasks.length;
                const done = emp.onboardingTasks.filter((t) => t.status === "COMPLETED").length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                return (
                  <Link key={emp.id} href={`/hr/onboarding/${emp.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{emp.fullName} <span className="text-xs text-muted-foreground">({emp.employeeCode})</span></p>
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
