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
import { getTranslations, getLocale } from "next-intl/server";
import { getStatusLabel } from "@/lib/status-labels";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function TrainingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const tid = session.tenantId;
  const t = await getTranslations("hrTraining");
  const locale = await getLocale();

  const featureCheck = await canUseHrFeature(tid, "hr_training");
  if (!featureCheck.allowed) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Card className="border-dashed border-amber-300 bg-amber-50/40">
          <div className="pt-6 pb-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-amber-500" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">{t("featureGateTitle")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{featureCheck.reason ?? t("upgradeMessage")}</p>
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
          <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("totalCourses")}: {totalCourses} · {t("totalAssignments")}: {totalAssignments} · {t("overdueCount", { count: overdueAssignments })}</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Link href="/hr/training/courses/new" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
              <Plus className="h-3.5 w-3.5" /> {t("newCourse")}
            </Link>
            <Link href="/hr/training/assignments/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90">
              <Plus className="h-3.5 w-3.5" /> {t("assignTraining")}
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{totalCourses}</p>
          <p className="text-xs text-muted-foreground">{t("totalCourses")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{activeCourses}</p>
          <p className="text-xs text-muted-foreground">{t("activeCourses")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{totalAssignments}</p>
          <p className="text-xs text-muted-foreground">{t("totalAssignments")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{completedAssignments}</p>
          <p className="text-xs text-muted-foreground">{t("completed")}</p>
        </Card>
        <Card className={`border-border p-4 ${overdueAssignments > 0 ? "border-amber-300 bg-amber-50/40" : ""}`}>
          <p className="text-2xl font-bold text-foreground">{overdueAssignments}</p>
          <p className="text-xs text-muted-foreground">{t("overdue")}</p>
        </Card>
      </div>

      <Tabs defaultValue={tab || "courses"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="courses">{t("coursesTab")}</TabsTrigger>
          <TabsTrigger value="assignments">{t("assignmentsTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="courses">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">{t("trainingCourses")}</CardTitle>
                {canManage && (
                  <Link href="/hr/training/courses" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
                    {t("viewAll")}
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {courses.length === 0 ? (
                <EmptyState title={t("noTrainingCourses")} description={t("noTrainingCoursesDesc")} icon={BookOpen} />
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
                          <p className="text-xs text-muted-foreground">{categoryLabel(c.category)}{c.requiredForJobTitle ? ` · ${t("requiredFor")} ${c.requiredForJobTitle}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={c.active ? "default" : "outline"} className="text-[10px]">{c.active ? t("active") : t("inactive")}</Badge>
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
                <CardTitle className="text-sm font-semibold text-foreground">{t("trainingAssignments")}</CardTitle>
                <Link href="/hr/training/assignments" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
                  {t("viewAll")}
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <EmptyState title={t("noTrainingAssignments")} description={t("noTrainingAssignmentsDesc")} icon={GraduationCap} />
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
                            {a.course.title} · {a.dueDate ? `${t("due")} ${new Date(a.dueDate).toLocaleDateString()}` : t("noDueDate")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={a.status === "COMPLETED" ? "default" : "outline"} className={`text-[10px] ${statusColor(a.status)}`}>{getStatusLabel(a.status, locale)}</Badge>
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
