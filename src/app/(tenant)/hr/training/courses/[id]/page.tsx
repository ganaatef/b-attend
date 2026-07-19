import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { updateTrainingCourseAction } from "../../../actions";
import { GraduationCap, BookOpen } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { displayTrainingCategory } from "@/lib/locale-display";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const { id } = await params;
  const tid = session.tenantId;
  const t = await getTranslations("hrTraining");
  const locale = await getLocale();

  const course = await db.trainingCourse.findFirst({ where: { id, companyId: tid } });
  if (!course) notFound();

  const canManage = hasPerm(session.role, "MANAGE_TRAINING");

  const assignmentCount = await db.trainingAssignment.count({ where: { courseId: course.id, companyId: tid } });
  const completedCount = await db.trainingAssignment.count({ where: { courseId: course.id, companyId: tid, status: "COMPLETED" } });
  const overdueCount = await db.trainingAssignment.count({ where: { courseId: course.id, companyId: tid, status: "OVERDUE" } });


  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/training/courses" className="text-xs text-muted-foreground hover:text-foreground">← {t("trainingCourses")}</Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">{course.title}</h1>
            <p className="text-sm text-muted-foreground">{displayTrainingCategory(course.category, locale)}</p>
          </div>
          <Badge variant={course.active ? "default" : "outline"} className="text-xs">{course.active ? t("active") : t("inactive")}</Badge>
        </div>
      </div>

      {course.description && (
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-foreground">{t("description")}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{course.description}</p></CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("category")}</p>
          <p className="text-sm font-semibold text-foreground">{displayTrainingCategory(course.category, locale)}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("requiredForJobTitle")}</p>
          <p className="text-sm font-semibold text-foreground">{course.requiredForJobTitle ?? "—"}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("validity")}</p>
          <p className="text-sm font-semibold text-foreground">{course.validityMonths ? `${course.validityMonths} ${t("months")}` : t("noExpiry")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("status")}</p>
          <p className="text-sm font-semibold text-foreground">{course.active ? t("active") : t("inactive")}</p>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{assignmentCount}</p>
          <p className="text-xs text-muted-foreground">{t("totalAssignments")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{completedCount}</p>
          <p className="text-xs text-muted-foreground">{t("completed")}</p>
        </Card>
        <Card className={`border-border p-4 ${overdueCount > 0 ? "border-amber-300 bg-amber-50/40" : ""}`}>
          <p className="text-2xl font-bold text-foreground">{overdueCount}</p>
          <p className="text-xs text-muted-foreground">{t("overdue")}</p>
        </Card>
      </div>

      {canManage && (
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("actions")}</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            {course.active ? (
              <form action={async () => {
                "use server";
                await updateTrainingCourseAction(course.id, { active: false });
              }}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5">
                  {t("deactivate")}
                </button>
              </form>
            ) : (
              <form action={async () => {
                "use server";
                await updateTrainingCourseAction(course.id, { active: true });
              }}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-success px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-success/90">
                  {t("activate")}
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
