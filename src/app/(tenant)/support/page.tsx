/** /support — customer support tickets list + new ticket form */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { TicketForm } from "./TicketForm";
import { LifeBuoy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const session = await getSession();
  if (!session?.tenantId) return null;
  const tickets = await db.supportTicket.findMany({
    where: { companyId: session.tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div><h1 className="text-lg font-bold text-foreground">Support</h1><p className="text-sm text-muted-foreground">Submit a ticket or check existing ones.</p></div>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">New ticket</CardTitle></CardHeader>
        <CardContent><TicketForm /></CardContent>
      </Card>
      <Card className="border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Your tickets ({tickets.length})</CardTitle></CardHeader>
        <CardContent>
          {tickets.length === 0 ? <EmptyState title="No tickets yet" icon={LifeBuoy} /> : (
            <div className="divide-y divide-border/60">
              {tickets.map((t) => (
                <Link key={t.id} href={`/support/${t.id}`} className="flex items-center justify-between py-3 hover:bg-muted/30">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">{t.category ?? "Uncategorized"} · {t._count.messages} messages · {new Date(t.createdAt).toLocaleDateString()}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{t.status.replace(/_/g, " ")}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
