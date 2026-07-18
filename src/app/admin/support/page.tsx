/** /admin/support */
import Link from "next/link";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { LifeBuoy } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const t = await getTranslations("adminSupport");
  const locale = await getLocale();
  const isArabic = locale === "ar";

  const tickets = await db.supportTicket.findMany({ include: { tenant: true, _count: { select: { messages: true } } }, orderBy: { createdAt: "desc" } });
  const statusFilters = ["ALL", "OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];

  const statusLabels: Record<string, string> = {
    ALL: "ALL",
    OPEN: isArabic ? "مفتوح" : "Open",
    IN_PROGRESS: isArabic ? "قيد التنفيذ" : "In Progress",
    WAITING_CUSTOMER: isArabic ? "بانتظار العميل" : "Waiting",
    RESOLVED: isArabic ? "محلول" : "Resolved",
    CLOSED: isArabic ? "مغلق" : "Closed",
  };

  const statusBadgeLabels: Record<string, string> = {
    ALL: "ALL",
    OPEN: isArabic ? "مفتوح" : "Open",
    IN_PROGRESS: isArabic ? "قيد التنفيذ" : "In Progress",
    WAITING_CUSTOMER: isArabic ? "بانتظار العميل" : "Waiting",
    RESOLVED: isArabic ? "محلول" : "Resolved",
    CLOSED: isArabic ? "مغلق" : "Closed",
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">{t("supportTickets")}</h1>
        <p className="text-sm text-muted-foreground">{t("ticketCount", { count: tickets.length })}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {statusFilters.map((s) => (
          <Link key={s} href={s === "ALL" ? "/admin/support" : `/admin/support?status=${s}`} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">{statusLabels[s]}</Link>
        ))}
      </div>
      <Card className="border-border">
        {tickets.length === 0 ? <EmptyState title={t("noTickets")} icon={LifeBuoy} /> : (
          <div className="divide-y divide-border/60">
            {tickets.map((ticket) => (
              <Link key={ticket.id} href={`/admin/support/${ticket.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">{ticket.tenant?.name ?? ticket.createdByEmail} · {ticket._count.messages} {t("messages")}</p>
                </div>
                <Badge variant="outline" className="text-xs">{statusBadgeLabels[ticket.status]}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
