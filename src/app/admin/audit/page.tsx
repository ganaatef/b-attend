/** /admin/audit */
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { ScrollText } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { getTranslations, getLocale } from "next-intl/server";
import { displayAuditAction } from "@/lib/locale-display";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const t = await getTranslations("adminAudit");
  const locale = await getLocale();
  const params = await searchParams;
  const where: any = params.action ? { action: params.action } : {};
  const logs = await db.platformAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  const actions = await db.platformAuditLog.findMany({ distinct: ["action"], select: { action: true } });

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <a href="/admin/audit" className={`rounded-md px-3 py-1.5 text-xs font-medium ${!params.action ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"}`}>{t("all")}</a>
        {actions.map((a) => (
          <a key={a.action} href={`/admin/audit?action=${a.action}`} className={`rounded-md px-3 py-1.5 text-xs font-medium ${params.action === a.action ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"}`}>{displayAuditAction(a.action, locale)}</a>
        ))}
      </div>
      <Card className="border-border">
        {logs.length === 0 ? <EmptyState title={t("noAudit")} icon={ScrollText} /> : (
          <div className="max-h-[70vh] overflow-y-auto battend-scroll">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-border bg-card text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t("when")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("actor")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("action")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("entity")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("reason")}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                    <td className="px-4 py-2.5 text-xs text-foreground">{l.actorEmail}</td>
                    <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{displayAuditAction(l.action, locale)}</Badge></td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.entityType ?? "—"} {l.entityId ? `· ${l.entityId.slice(0, 8)}` : ""}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
