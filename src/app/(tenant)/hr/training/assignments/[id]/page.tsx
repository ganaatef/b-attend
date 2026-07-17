import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { markTrainingInProgressAction, markTrainingCompletedAction, cancelTrainingAssignmentAction } from "../../../actions";
import { GraduationCap } from "lucide-react";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const { id } = await params;
  const tid = session.tenantId;

  const assignment = await db.trainingAssignment.findFirst({
    where: { id, companyId: tid },
    include: {
      employee: { select: { id: true, fullName: true, employeeCode: true, branch: { select: { name: true } } } },
      course: true,
    },
  });
  if (!assignment) notFound();

  const canManage = hasPerm(session.role, "MANAGE_TRAINING");

  const statusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "bg-brand-success text-white border-transparent";
      case "OVERDUE": return "bg-destructive/10 text-destructive border-destructive/20";
      case "IN_PROGRESS": return "bg-amber-50 text-amber-600 border-amber-200";
      case "ASSIGNED": return "";
      case "CANCELLED": return "bg-muted text-muted-foreground border-border";
      default: return "";
    }
  };

  const categoryLabel = (cat: string) => cat.replace(/_/g, " ");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/training/assignments" className="text-xs text-muted-foreground hover:text-foreground">← Training Assignments</Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">Training Assignment</h1>
            <p className="text-sm text-muted-foreground">{assignment.employee.fullName} ({assignment.employee.employeeCode})</p>
          </div>
          <Badge variant={assignment.status === "COMPLETED" ? "default" : "outline"} className={`text-[10px] ${statusColor(assignment.status)}`}>{assignment.status.replace(/_/g, " ")}</Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">Employee</p>
          <p className="text-sm font-semibold text-foreground">{assignment.employee.fullName} ({assignment.employee.employeeCode})</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">Branch</p>
          <p className="text-sm font-semibold text-foreground">{assignment.employee.branch?.name ?? "—"}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">Course</p>
          <p className="text-sm font-semibold text-foreground">{assignment.course.title} ({categoryLabel(assignment.course.category)})</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">Category</p>
          <p className="text-sm font-semibold text-foreground">{categoryLabel(assignment.course.category)}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">Assigned Date</p>
          <p className="text-sm font-semibold text-foreground">{new Date(assignment.assignedAt).toLocaleDateString()}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">Due Date</p>
          <p className="text-sm font-semibold text-foreground">{assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : "No due date"}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">Score</p>
          <p className="text-sm font-semibold text-foreground">{assignment.score !== null ? `${assignment.score}%` : "—"}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">Completed At</p>
          <p className="text-sm font-semibold text-foreground">{assignment.completedAt ? new Date(assignment.completedAt).toLocaleDateString() : "—"}</p>
        </Card>
      </div>

      {assignment.notes && (
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-foreground">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{assignment.notes}</p></CardContent>
        </Card>
      )}

      {canManage && (assignment.status === "ASSIGNED" || assignment.status === "IN_PROGRESS") && (
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {assignment.status === "ASSIGNED" && (
              <form action={async () => {
                "use server";
                await markTrainingInProgressAction(assignment.id);
              }}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
                  Mark In Progress
                </button>
              </form>
            )}

            {(assignment.status === "ASSIGNED" || assignment.status === "IN_PROGRESS") && (
              <form action={async (formData: FormData) => {
                "use server";
                const score = formData.get("score") ? Number(formData.get("score")) : undefined;
                await markTrainingCompletedAction(assignment.id, score);
              }} className="flex items-end gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Score (%)</label>
                  <input name="score" type="number" min="0" max="100" placeholder="Optional" className="flex h-9 w-32 rounded-md border border-input bg-transparent px-3 text-sm" />
                </div>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-success px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-success/90">
                  Mark Completed
                </button>
              </form>
            )}

            <form action={async () => {
              "use server";
              await cancelTrainingAssignmentAction(assignment.id);
            }}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5">
                Cancel
              </button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
