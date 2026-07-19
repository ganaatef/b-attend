/**
 * /coach-library — Owner/HR manage coach tips + create custom.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { BookOpen, Lock } from "lucide-react";
import { TipForm } from "./TipForm";
import { toggleTipAction, deleteTipAction } from "./actions";
import { canUseAiFeature } from "@/lib/ai/feature-gates";

export const dynamic = "force-dynamic";

export default async function CoachLibraryPage() {
  const t = await getTranslations("coach");
  const session = await getSession();
  if (!session?.tenantId) return null;
  if (session.role !== "COMPANY_OWNER" && session.role !== "HR_ADMIN") {
    return <div className="p-4 text-sm text-muted-foreground">{t("libraryAccessDenied")}</div>;
  }

  const gate = await canUseAiFeature(session.tenantId, "coach_library");
  if (!gate.allowed) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="pt-6 text-center">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold text-foreground">{t("libraryNotAvailable")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{gate.reason}</p>
            <Link href="/billing" className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">{t("viewPlans")}</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tips = await db.coachTip.findMany({
    where: { OR: [{ companyId: session.tenantId }, { isSystemDefault: true }] },
    orderBy: [{ isSystemDefault: "desc" }, { createdAt: "desc" }],
  });

  const customTips = tips.filter((tip) => !tip.isSystemDefault);
  const systemTips = tips.filter((tip) => tip.isSystemDefault);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">{t("libraryTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("librarySubtitle", { customCount: customTips.length, systemCount: systemTips.length })}</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("addCustomTip")}</CardTitle></CardHeader>
        <CardContent><TipForm /></CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("customTips", { count: customTips.length })}</CardTitle></CardHeader>
        <CardContent>
          {customTips.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noCustomTipsYet")}</p>
          ) : (
            <div className="space-y-2">
              {customTips.map((tip) => (
                <div key={tip.id} className="rounded-md border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{tip.title}</p>
                        <Badge variant="outline" className="text-[10px]">{tip.theme.replace(/_/g, " ").toLowerCase()}</Badge>
                        {!tip.active && <Badge variant="secondary" className="text-[10px]">{t("inactive")}</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{tip.body}</p>
                    </div>
                    <div className="flex gap-1">
                      <form action={async () => { "use server"; await toggleTipAction(tip.id); }}>
                        <button type="submit" className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted">{tip.active ? t("deactivate") : t("activate")}</button>
                      </form>
                      <form action={async () => { "use server"; await deleteTipAction(tip.id); }}>
                        <button type="submit" className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10">{t("delete")}</button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("systemDefaultTips", { count: systemTips.length })}</CardTitle></CardHeader>
        <CardContent>
          {systemTips.length === 0 ? (
            <EmptyState title={t("noSystemTips")} icon={BookOpen} />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {systemTips.map((tip) => (
                <div key={tip.id} className="rounded-md border border-border bg-card/50 p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{tip.theme.replace(/_/g, " ").toLowerCase()}</Badge>
                    {!tip.active && <Badge variant="secondary" className="text-[10px]">{t("inactive")}</Badge>}
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">{tip.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{tip.body}</p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">{t("systemTipNote")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
