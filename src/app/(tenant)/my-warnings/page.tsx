import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { AlertTriangle } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { getStatusLabel } from "@/lib/status-labels";
import { displayWarningType } from "@/lib/locale-display";

export const dynamic = "force-dynamic";

export default async function MyWarningsPage() {
  const t = await getTranslations("myWarnings");
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

  const warnings = await db.employeeWarning.findMany({
    where: {
      companyId: session.tenantId,
      employeeId,
      OR: [
        { status: "OPEN" },
        { status: "ACKNOWLEDGED" },
      ],
    },
    orderBy: { date: "desc" },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge variant="destructive">{t("open")}</Badge>;
      case "ACKNOWLEDGED":
        return <Badge variant="default" className="bg-amber-500 text-white border-transparent">{t("acknowledged")}</Badge>;
      case "RESOLVED":
        return <Badge variant="default" className="bg-brand-success text-white border-transparent">{t("resolved")}</Badge>;
      case "CANCELLED":
        return <Badge variant="outline">{t("cancelled")}</Badge>;
      default:
        return <Badge variant="outline">{getStatusLabel(status, locale)}</Badge>;
    }
  };

  const severityBadge = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return <Badge variant="destructive">{t("critical")}</Badge>;
      case "HIGH":
        return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">{t("high")}</Badge>;
      case "MEDIUM":
        return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">{t("medium")}</Badge>;
      case "LOW":
        return <Badge variant="outline">{t("low")}</Badge>;
      default:
        return <Badge variant="outline">{getStatusLabel(severity, locale)}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">{t("myWarningsTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("myWarningsSubtitle")}</p>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">{t("warningsCount", { count: warnings.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {warnings.length === 0 ? (
            <EmptyState title={t("noWarnings")} icon={AlertTriangle} />
          ) : (
            <div className="space-y-3">
              {warnings.map((w) => (
                <div key={w.id} className="rounded-md border border-border/60 bg-card px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{displayWarningType(w.type, locale)}</span>
                      {severityBadge(w.severity)}
                      {statusBadge(w.status)}
                    </div>
                    <span className="text-xs text-muted-foreground"><bdi dir="ltr">{new Date(w.date).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}</bdi></span>
                  </div>
                  {w.reason && <p className="mt-1 text-xs text-muted-foreground">{w.reason}</p>}
                  {w.acknowledgedByEmployee && w.acknowledgedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">{t("acknowledgedOn", { date: <bdi dir="ltr">{new Date(w.acknowledgedAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US")}</bdi> as any })}</p>
                  )}
                  {w.status === "OPEN" && !w.acknowledgedByEmployee && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-muted-foreground">{t("acknowledgeNote")}</p>
                      <form action={async (formData: FormData) => {
                        "use server";
                        const warningId = formData.get("warningId") as string;
                        const { acknowledgeWarningAction } = await import("../hr/actions");
                        await acknowledgeWarningAction(warningId);
                      }}>
                        <input type="hidden" name="warningId" value={w.id} />
                        <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
                          {t("acknowledge")}
                        </button>
                      </form>
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
