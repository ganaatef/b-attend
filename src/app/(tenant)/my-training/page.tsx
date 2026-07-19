import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { GraduationCap } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { getStatusLabel } from "@/lib/status-labels";

export const dynamic = "force-dynamic";

export default async function MyTrainingPage() {
  const t = await getTranslations("myTraining");
  const locale = await getLocale();
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;

  const user = await db.user.findUnique({ where: { id: session.sub }, include: { employee: true } });
  const employee = user?.employee;

  if (!employee) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Card>
          <CardContent className="py-6">
            <p className="text-center text-sm text-muted-foreground">{t("noLinkedEmployee")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const employeeId = employee.id;

  const assignments = await db.trainingAssignment.findMany({
    where: { employeeId, companyId: session.tenantId },
    include: { course: true },
    orderBy: { createdAt: "desc" },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <Badge variant="default" className="bg-brand-success text-white border-transparent">{t("completed")}</Badge>;
      case "IN_PROGRESS":
        return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">{t("inProgress")}</Badge>;
      case "ASSIGNED":
        return <Badge variant="outline">{t("assigned")}</Badge>;
      case "OVERDUE":
        return <Badge variant="destructive">{t("overdue")}</Badge>;
      default:
        return <Badge variant="outline">{getStatusLabel(status, locale)}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">{t("myTrainingTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("myTrainingSubtitle")}</p>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">{t("trainingAssignments", { count: assignments.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <EmptyState title={t("noTrainingAssignments")} icon={GraduationCap} />
          ) : (
            <div className="divide-y divide-border/60">
              {assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{a.course.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.course.category}
                        {a.dueDate && ` · ${t("due")} ${new Date(a.dueDate).toLocaleDateString()}`}
                        {a.score != null && ` · ${t("scoreLabel")}: ${a.score}`}
                        {a.completedAt && ` · ${t("completedOn")} ${new Date(a.completedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  {statusBadge(a.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
