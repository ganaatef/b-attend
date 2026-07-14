/**
 * /admin/coach-library — Super Admin manages system default tips.
 */
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { BookOpen } from "lucide-react";
import { SystemTipForm } from "./SystemTipForm";
import { toggleSystemTipAction, deleteSystemTipAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminCoachLibraryPage() {
  const tips = await db.coachTip.findMany({
    where: { isSystemDefault: true },
    orderBy: { theme: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">System Coach Tips</h1>
        <p className="text-sm text-muted-foreground">{tips.length} system default tips available to all tenants.</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Add system tip</CardTitle></CardHeader>
        <CardContent><SystemTipForm /></CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">All system tips</CardTitle></CardHeader>
        <CardContent>
          {tips.length === 0 ? <EmptyState title="No system tips" icon={BookOpen} /> : (
            <div className="space-y-2">
              {tips.map((t) => (
                <div key={t.id} className="rounded-md border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{t.title}</p>
                        <Badge variant="outline" className="text-[10px]">{t.theme.replace(/_/g, " ").toLowerCase()}</Badge>
                        <Badge variant="outline" className="text-[10px]">{t.roleTarget.replace(/_/g, " ").toLowerCase()}</Badge>
                        {!t.active && <Badge variant="secondary" className="text-[10px]">inactive</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{t.body}</p>
                    </div>
                    <div className="flex gap-1">
                      <form action={async () => { "use server"; await toggleSystemTipAction(t.id); }}>
                        <button type="submit" className="rounded-md border border-border bg-background px-2 py-1 text-xs hover:bg-muted">{t.active ? "Deactivate" : "Activate"}</button>
                      </form>
                      <form action={async () => { "use server"; await deleteSystemTipAction(t.id); }}>
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
