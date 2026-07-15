import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { getRolePermissions, type HrPermission, getManagedBranchIds } from "@/lib/hr/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, BookOpen, Plus, AlertTriangle, CheckCircle2, Clock, Eye, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function TrainingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const tid = session.tenantId;

  const featureCheck = await canUseHrFeature(tid, "hr_training");
  if (!featureCheck.allowed) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Card className="border-dashed border-amber-300 bg-amber-50/40">
          <div className="pt-6 pb-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-amber-500" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">Training &amp; Development requires Growth plan or higher</h3>
            <p className="mt-1 text-xs text-muted-foreground">{featureCheck.reason ?? "Upgrade to access training features."}</p>
          </div>
        </Card>
      </div>
    );
  }

  const { tab } = await searchParams;
  const canManage = hasPerm(session.role, "MANAGE_TRAINING");

  const isBranchManager = session.role === "BRANCH_MANAGER";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, tid) : [];
  const branchFilter = isBranchManager && managedBranchIds.length > 0
    ? { employee: { branchId: { in: managedBranchIds } } }
    : {};

  const [courses, assignments] = await Promise.all([
    db.trainingCourse.findMany({ where: { companyId: tid }, orderBy: { createdAt: "desc" } }),
    db.trainingAssignment.findMany({
      where: { companyId: tid, ...branchFilter },
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true } },
        course: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalCourses = courses.length;
  const activeCourses = courses.filter((c) => c.active).length;
  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter((a) => a.status === "COMPLETED").length;
  const overdueAssignments = assignments.filter((a) => a.status === "OVERDUE").length;

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
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Training</h1>
          <p className="text-sm text-muted-foreground">{totalCourses} courses · {totalAssignments} assignments · {overdueAssignments} overdue</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Link href="/hr/training/courses/new" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
              <Plus className="h-3.5 w-3.5" /> New Course
            </Link>
            <Link href="/hr/training/assignments/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90">
              <Plus className="h-3.5 w-3.5" /> Assign Training
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{totalCourses}</p>
          <p className="text-xs text-muted-foreground">Total courses</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{activeCourses}</p>
          <p className="text-xs text-muted-foreground">Active courses</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{totalAssignments}</p>
          <p className="text-xs text-muted-foreground">Total assignments</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{completedAssignments}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </Card>
        <Card className={`border-border p-4 ${overdueAssignments > 0 ? "border-amber-300 bg-amber-50/40" : ""}`}>
          <p className="text-2xl font-bold text-foreground">{overdueAssignments}</p>
          <p className="text-xs text-muted-foreground">Overdue</p>
        </Card>
      </div>

      <Tabs defaultValue={tab || "courses"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="courses">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">Training Courses</CardTitle>
                {canManage && (
                  <Link href="/hr/training/courses" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
                    View All
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {courses.length === 0 ? (
                <EmptyState title="No training courses" description="Create your first training course" icon={BookOpen} />
              ) : (
                <div className="divide-y divide-border/60">
                  {courses.slice(0, 10).map((c) => (
                    <Link key={c.id} href={`/hr/training/courses/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                          <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{c.title}</p>
                          <p className="text-xs text-muted-foreground">{categoryLabel(c.category)}{c.requiredForJobTitle ? ` · Required for ${c.requiredForJobTitle}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={c.active ? "default" : "outline"} className="text-[10px]">{c.active ? "Active" : "Inactive"}</Badge>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">Training Assignments</CardTitle>
                <Link href="/hr/training/assignments" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
                  View All
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <EmptyState title="No training assignments" description="Assign training to employees" icon={GraduationCap} />
              ) : (
                <div className="divide-y divide-border/60">
                  {assignments.slice(0, 10).map((a) => (
                    <Link key={a.id} href={`/hr/training/assignments/${a.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                          <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{a.employee.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.course.title} · {a.dueDate ? `Due ${new Date(a.dueDate).toLocaleDateString()}` : "No due date"}
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
