/** /admin/support/[id] */
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReplyForm } from "./ReplyForm";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = await db.supportTicket.findUnique({ where: { id }, include: { tenant: true, messages: { orderBy: { createdAt: "asc" } } } });
  if (!ticket) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link href="/admin/support" className="text-xs text-muted-foreground hover:text-foreground">← Support tickets</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">{ticket.subject}</h1>
        <p className="text-sm text-muted-foreground">{ticket.tenant?.name ?? ticket.createdByEmail} · {ticket.category ?? "Uncategorized"} · {ticket.priority} priority</p>
        <Badge variant="outline" className="mt-2 text-xs">{ticket.status.replace(/_/g, " ")}</Badge>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Conversation</CardTitle></CardHeader>
        <CardContent>
          {ticket.messages.length === 0 ? <EmptyState title="No messages yet" icon={MessageSquare} /> : (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto battend-scroll">
              {ticket.messages.map((m) => (
                <div key={m.id} className={`rounded-md border px-3 py-2 text-sm ${m.isInternal ? "border-amber-300 bg-amber-50/40" : "border-border bg-card"}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{m.authorEmail} <span className="text-muted-foreground">· {m.authorRole.replace(/_/g, " ")}</span></span>
                    <span className="text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-foreground/90 whitespace-pre-wrap">{m.body}</p>
                  {m.isInternal && <p className="mt-1 text-xs text-amber-700">Internal note</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Reply</CardTitle></CardHeader>
        <CardContent><ReplyForm ticketId={ticket.id} /></CardContent>
      </Card>
    </div>
  );
}
