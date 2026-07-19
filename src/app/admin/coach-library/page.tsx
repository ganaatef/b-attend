/**
 * /admin/coach-library — Super Admin manages system default tips.
 */
import { getTranslations, getLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { BookOpen } from "lucide-react";
import { SystemTipForm } from "./SystemTipForm";
import { toggleSystemTipAction, deleteSystemTipAction } from "./actions";
import { displayCoachTheme, displayCoachAudience } from "@/lib/locale-display";

export const dynamic = "force-dynamic";

export default async function AdminCoachLibraryPage() {
  const t = await getTranslations("adminCoachLibrary");
  const locale = await getLocale();
  const tips = await db.coachTip.findMany({
    where: { isSystemDefault: true },
    orderBy: { theme: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{tips.length} system default tips available to all tenants.</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("addTip")}</CardTitle></CardHeader>
        <CardContent><SystemTipForm /></CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">All system tips</CardTitle></CardHeader>
        <CardContent>
          {tips.length === 0 ? <EmptyState title={t("noTips")} icon={BookOpen} /> : (
            <div className="space-y-2">
              {tips.map((tip) => (
                <div key={tip.id} className="rounded-md border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{tip.title}</p>
                        <Badge variant="outline" className="text-xs">{displayCoachTheme(tip.theme, locale)}</Badge>
                        <Badge variant="outline" className="text-xs">{displayCoachAudience(tip.roleTarget, locale)}</Badge>
                        {!tip.active && <Badge variant="secondary" className="text-xs">inactive</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{tip.body}</p>
                    </div>
                    <div className="flex gap-1">
                      <form action={async () => { "use server"; await toggleSystemTipAction(tip.id); }}>
                        <button type="submit" className="rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted">{tip.active ? "Deactivate" : "Activate"}</button>
                      </form>
                      <form action={async () => { "use server"; await deleteSystemTipAction(tip.id); }}>
                        <button type="submit" className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive hover:bg-destructive/10">Delete</button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
