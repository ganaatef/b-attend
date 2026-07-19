/** /support/[id] */
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TicketReplyForm } from "./TicketReplyForm";
import { formatDateTime } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("support");
  const session = await getSession();
  if (!session?.tenantId) return null;
  const { id } = await params;
  const ticket = await db.supportTicket.findFirst({ where: { id, companyId: session.tenantId }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!ticket) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/support" className="text-xs text-muted-foreground hover:text-foreground">← {t("backToSupport")}</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">{ticket.subject}</h1>
        <p className="text-sm text-muted-foreground">{ticket.category ?? t("uncategorized")} · {ticket.priority} {t("priorityLabel")}</p>
        <Badge variant="outline" className="mt-2 text-xs">{ticket.status.replace(/_/g, " ")}</Badge>
      </div>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("conversationCard")}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto battend-scroll">
            {ticket.messages.map((m) => (
              <div key={m.id} className={`rounded-md border px-3 py-2 text-sm ${m.isInternal ? "border-amber-300 bg-amber-50/40" : m.authorRole === "SUPPORT_AGENT" || m.authorRole === "SUPER_ADMIN" ? "border-brand-accent/30 bg-brand-accent/5" : "border-border bg-card"}`}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{m.authorEmail} <span className="text-muted-foreground">· {m.authorRole.replace(/_/g, " ")}</span></span>
                  <span className="text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                </div>
                <p className="mt-1 text-foreground/90 whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {ticket.status !== "CLOSED" && ticket.status !== "RESOLVED" && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("replyCard")}</CardTitle></CardHeader>
          <CardContent><TicketReplyForm ticketId={ticket.id} /></CardContent>
        </Card>
      )}
    </div>
  );
}
