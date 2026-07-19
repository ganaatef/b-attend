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
  completeOffboardingTaskAction,
  cancelOffboardingTaskAction,
  createOffboardingTaskAction,
  disableEmployeeUserAccessAction,
  finalizeOffboardingAction,
} from "../../actions";
import { getTranslations, getLocale } from "next-intl/server";
import { getStatusLabel } from "@/lib/status-labels";
import { UserMinus, CheckCircle2, XCircle, AlertTriangle, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function OffboardingDetailPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE" || session.role === "BRANCH_MANAGER") return null;
  const { employeeId } = await params;
  const tid = session.tenantId;

  const canManage = hasPerm(session.role, "MANAGE_OFFBOARDING");
  const t = await getTranslations("hrOffboarding");
  const locale = await getLocale();

  const employee = await db.employee.findFirst({
    where: { id: employeeId, companyId: tid, deletedAt: null },
    include: {
      branch: { select: { name: true } },
      department: { select: { name: true } },
      offboardingTasks: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!employee) notFound();

  const tasks = employee.offboardingTasks;
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "COMPLETED").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allTasksCompleted = total > 0 && tasks.every((t) => t.status === "COMPLETED" || t.status === "CANCELLED");

  const taskStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING": return <Badge variant="outline" className="text-xs">{getStatusLabel(status, locale)}</Badge>;
      case "IN_PROGRESS": return <Badge variant="outline" className="text-xs border-amber-300 text-amber-600 bg-amber-50">{getStatusLabel(status, locale)}</Badge>;
      case "COMPLETED": return <Badge variant="default" className="text-xs bg-emerald-600 text-white border-transparent">{getStatusLabel(status, locale)}</Badge>;
      case "CANCELLED": return <Badge variant="outline" className="text-xs text-muted-foreground">{getStatusLabel(status, locale)}</Badge>;
      default: return <Badge variant="outline" className="text-xs">{getStatusLabel(status, locale)}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/offboarding" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Offboarding
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">{employee.fullName}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{employee.employeeCode}</span>
              <span>&middot;</span>
              <Badge variant={employee.status === "LEFT" ? "default" : "outline"} className={`text-xs ${employee.status === "LEFT" ? "bg-brand-success text-white border-transparent" : ""}`}>{getStatusLabel(employee.status, locale)}</Badge>
              <span>&middot;</span>
              <span>{employee.branch?.name ?? "—"}</span>
            </div>
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
            <span>{t("progress")}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
        </Card>
      )}

      {canManage && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">{t("addTask")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={async (formData: FormData) => { "use server"; await createOffboardingTaskAction({}, formData); }} className="flex flex-col gap-2">
              <input type="hidden" name="employeeId" value={employeeId} />
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="task-title" className="sr-only">Title</Label>
                  <Input id="task-title" name="title" required placeholder={t("taskTitle")} className="h-8 text-xs" />
                </div>
                <div className="w-40">
                  <Label htmlFor="task-due" className="sr-only">Due date</Label>
                  <Input id="task-due" name="dueDate" type="date" className="h-8 text-xs" />
                </div>
              </div>
              <div>
                <Label htmlFor="task-desc" className="sr-only">Description</Label>
                <Input id="task-desc" name="description" placeholder={t("taskDescription")} className="h-8 text-xs" />
              </div>
              <Button type="submit" size="sm" className="w-fit h-8">{t("addTask")}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {canManage && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">{t("disableUserAccess")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">This will immediately disable the employee&apos;s portal and system access.</p>
              <form action={async () => { "use server"; await disableEmployeeUserAccessAction(employeeId); }}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5">
                  {t("disableAccess")}
                </button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">{t("finalizeOffboarding")}</CardTitle>
            </CardHeader>
            <CardContent>
              {allTasksCompleted ? (
                <>
                  <p className="text-xs text-muted-foreground mb-3">{t("allTasksCompleted")}</p>
                  <form action={async () => { "use server"; await finalizeOffboardingAction(employeeId); }}>
                    <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-success px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-success/90">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {t("finalize")}
                    </button>
                  </form>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{t("completeAllTasks")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <EmptyState title="No offboarding tasks" icon={UserMinus} />
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
                    {task.dueDate && <p className="text-xs text-muted-foreground mt-0.5">{t("dueLabel")} {new Date(task.dueDate).toLocaleDateString()}</p>}
                  </div>
                  {canManage && (task.status === "PENDING" || task.status === "IN_PROGRESS") && (
                    <div className="flex items-center gap-1 ml-3">
                      <form action={async () => { "use server"; await completeOffboardingTaskAction(task.id); }}>
                        <button type="submit" className="inline-flex items-center gap-1 rounded-md bg-brand-success px-2 py-1 text-xs font-medium text-white hover:bg-brand-success/90">
                          <CheckCircle2 className="h-3 w-3" /> {t("complete")}
                        </button>
                      </form>
                      {task.status === "PENDING" && (
                        <form action={async () => { "use server"; await cancelOffboardingTaskAction(task.id); }}>
                          <button type="submit" className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/5">
                            <XCircle className="h-3 w-3" /> {t("cancel")}
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
