/** /admin/support */
import Link from "next/link";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { LifeBuoy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const tickets = await db.supportTicket.findMany({ include: { tenant: true, _count: { select: { messages: true } } }, orderBy: { createdAt: "desc" } });
  const statusFilters = ["ALL", "OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">Support tickets</h1>
        <p className="text-sm text-muted-foreground">{tickets.length} tickets across all tenants.</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {statusFilters.map((s) => (
          <Link key={s} href={s === "ALL" ? "/admin/support" : `/admin/support?status=${s}`} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">{s.replace(/_/g, " ")}</Link>
        ))}
      </div>
      <Card className="border-border">
        {tickets.length === 0 ? <EmptyState title="No support tickets" icon={LifeBuoy} /> : (
          <div className="divide-y divide-border/60">
            {tickets.map((t) => (
              <Link key={t.id} href={`/admin/support/${t.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">{t.tenant?.name ?? t.createdByEmail} · {t._count.messages} messages</p>
                </div>
                <Badge variant="outline" className="text-xs">{t.status.replace(/_/g, " ")}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
