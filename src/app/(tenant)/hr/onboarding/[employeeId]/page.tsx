import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import {
  completeOnboardingTaskAction,
  cancelOnboardingTaskAction,
  createOnboardingTaskAction,
  createDefaultOnboardingChecklistAction,
} from "../../actions";
import { ClipboardList, CheckCircle2, XCircle, Clock, AlertTriangle, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function OnboardingDetailPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE" || session.role === "BRANCH_MANAGER") return null;
  const { employeeId } = await params;
  const tid = session.tenantId;

  const canManage = hasPerm(session.role, "MANAGE_ONBOARDING");

  const employee = await db.employee.findFirst({
    where: { id: employeeId, companyId: tid, deletedAt: null },
    include: {
      branch: { select: { name: true } },
      department: { select: { name: true } },
      onboardingTasks: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!employee) notFound();

  const tasks = employee.onboardingTasks;
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "COMPLETED").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const taskStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING": return <Badge variant="outline" className="text-[10px]">PENDING</Badge>;
      case "IN_PROGRESS": return <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 bg-amber-50">IN PROGRESS</Badge>;
      case "COMPLETED": return <Badge variant="default" className="text-[10px] bg-emerald-600 text-white border-transparent">COMPLETED</Badge>;
      case "CANCELLED": return <Badge variant="outline" className="text-[10px] text-muted-foreground">CANCELLED</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/onboarding" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Onboarding
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">{employee.fullName}</h1>
            <p className="text-sm text-muted-foreground">{employee.employeeCode} &middot; {employee.branch?.name ?? "—"} &middot; {employee.department?.name ?? "—"}</p>
          </div>
          {total > 0 && (
            <div className="text-right">
              <p className="text-xs font-medium text-foreground">{done}/{total} ({pct}%)</p>
            </div>
          )}
        </div>
      </div>

      {total > 0 && (
        <Card className="border-border p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
        </Card>
      )}

      {canManage && total === 0 && (
        <Card className="border-border">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-3">No onboarding tasks yet.</p>
            <form action={async () => { "use server"; await createDefaultOnboardingChecklistAction(employeeId); }}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90">
                <ClipboardList className="h-3.5 w-3.5" /> Create Default Checklist
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      {canManage && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Add Task</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={async (formData: FormData) => { "use server"; await createOnboardingTaskAction({}, formData); }} className="flex flex-col gap-2">
              <input type="hidden" name="employeeId" value={employeeId} />
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="task-title" className="sr-only">Title</Label>
                  <Input id="task-title" name="title" required placeholder="Task title" className="h-8 text-xs" />
                </div>
                <div className="w-40">
                  <Label htmlFor="task-due" className="sr-only">Due date</Label>
                  <Input id="task-due" name="dueDate" type="date" className="h-8 text-xs" />
                </div>
              </div>
              <div>
                <Label htmlFor="task-desc" className="sr-only">Description</Label>
                <Input id="task-desc" name="description" placeholder="Description (optional)" className="h-8 text-xs" />
              </div>
              <Button type="submit" size="sm" className="w-fit h-8">Add Task</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <EmptyState title="No onboarding tasks" icon={ClipboardList} />
          ) : (
            <div className="divide-y divide-border/60">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground text-sm truncate">{task.title}</p>
                      {taskStatusBadge(task.status)}
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>}
                    {task.dueDate && <p className="text-[10px] text-muted-foreground mt-0.5">Due: {new Date(task.dueDate).toLocaleDateString()}</p>}
                  </div>
                  {canManage && (task.status === "PENDING" || task.status === "IN_PROGRESS") && (
                    <div className="flex items-center gap-1 ml-3">
                      <form action={async () => { "use server"; await completeOnboardingTaskAction(task.id); }}>
                        <button type="submit" className="inline-flex items-center gap-1 rounded-md bg-brand-success px-2 py-1 text-[10px] font-medium text-white hover:bg-brand-success/90">
                          <CheckCircle2 className="h-3 w-3" /> Complete
                        </button>
                      </form>
                      {task.status === "PENDING" && (
                        <form action={async () => { "use server"; await cancelOnboardingTaskAction(task.id); }}>
                          <button type="submit" className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-[10px] font-medium text-destructive hover:bg-destructive/5">
                            <XCircle className="h-3 w-3" /> Cancel
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
