import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getRolePermissions, type HrPermission, getManagedBranchIds } from "@/lib/hr/permissions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { GraduationCap, Plus, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const tid = session.tenantId;
  const params = await searchParams;
  const canManage = hasPerm(session.role, "MANAGE_TRAINING");

  const isBranchManager = session.role === "BRANCH_MANAGER";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, tid) : [];
  const branchFilter = isBranchManager && managedBranchIds.length > 0
    ? { employee: { branchId: { in: managedBranchIds } } }
    : {};

  const where: any = { companyId: tid, ...branchFilter };
  if (params.status) where.status = params.status;

  const assignments = await db.trainingAssignment.findMany({
    where,
    include: {
      employee: { select: { id: true, fullName: true, employeeCode: true } },
      course: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const total = await db.trainingAssignment.count({ where: { companyId: tid, ...branchFilter } });
  const assignedCount = await db.trainingAssignment.count({ where: { companyId: tid, ...branchFilter, status: "ASSIGNED" } });
  const inProgressCount = await db.trainingAssignment.count({ where: { companyId: tid, ...branchFilter, status: "IN_PROGRESS" } });
  const completedCount = await db.trainingAssignment.count({ where: { companyId: tid, ...branchFilter, status: "COMPLETED" } });
  const overdueCount = await db.trainingAssignment.count({ where: { companyId: tid, ...branchFilter, status: "OVERDUE" } });

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

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Training Assignments</h1>
          <p className="text-sm text-muted-foreground">{total} total · {assignedCount} assigned · {overdueCount} overdue</p>
        </div>
        {canManage && (
          <Link href="/hr/training/assignments/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90">
            <Plus className="h-3.5 w-3.5" /> New Assignment
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{assignedCount}</p>
          <p className="text-xs text-muted-foreground">Assigned</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{inProgressCount}</p>
          <p className="text-xs text-muted-foreground">In Progress</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{completedCount}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </Card>
        <Card className={`border-border p-4 ${overdueCount > 0 ? "border-amber-300 bg-amber-50/40" : ""}`}>
          <p className="text-2xl font-bold text-foreground">{overdueCount}</p>
          <p className="text-xs text-muted-foreground">Overdue</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/hr/training/assignments" className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium ${!params.status ? "bg-brand-accent text-white" : "border border-border bg-card text-foreground hover:bg-muted/40"}`}>
          All
        </Link>
        {["ASSIGNED", "IN_PROGRESS", "COMPLETED", "OVERDUE", "CANCELLED"].map((s) => (
          <Link key={s} href={`/hr/training/assignments?status=${s}`} className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium ${params.status === s ? "bg-brand-accent text-white" : "border border-border bg-card text-foreground hover:bg-muted/40"}`}>
            {s.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      <Card className="border-border">
        {assignments.length === 0 ? (
          <EmptyState title="No training assignments" description="Assign training to employees" icon={GraduationCap} />
        ) : (
          <div className="divide-y divide-border/60">
            {assignments.map((a) => (
              <Link key={a.id} href={`/hr/training/assignments/${a.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{a.employee.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.course.title} · {a.dueDate ? `Due ${new Date(a.dueDate).toLocaleDateString()}` : "No due date"}
                      {a.score !== null ? ` · Score: ${a.score}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={a.status === "COMPLETED" ? "default" : "outline"} className={`text-[10px] ${statusColor(a.status)}`}>{a.status.replace(/_/g, " ")}</Badge>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
