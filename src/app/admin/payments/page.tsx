/** /admin/payments */
import Link from "next/link";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";
import { getLocale } from "next-intl/server";
import { displayPaymentProvider } from "@/lib/locale-display";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

function money(amount: number, currency = "EGP") { return `${formatNumber(amount)} ${currency}`; }

export default async function PaymentsPage() {
  const locale = await getLocale();
  const payments = await db.payment.findMany({ include: { tenant: true, invoice: true }, orderBy: { createdAt: "desc" } });
  const total = payments.filter((p) => p.status === "CONFIRMED").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">Payments</h1>
        <p className="text-sm text-muted-foreground">{payments.length} payments · {money(total)} confirmed</p>
      </div>
      <Card className="border-border">
        {payments.length === 0 ? <EmptyState title="No payments yet" icon={Wallet} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Tenant</th>
                  <th className="px-4 py-3 text-left font-medium">Invoice</th>
                  <th className="px-4 py-3 text-left font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Provider</th>
                  <th className="px-4 py-3 text-left font-medium">Reference</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link href={`/admin/tenants/${p.tenantId}`} className="font-medium text-foreground hover:text-brand-accent">{p.tenant.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.invoice?.number ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{money(p.amount, p.currency)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{displayPaymentProvider(p.provider, locale)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.reference ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.status === "CONFIRMED" ? "default" : p.status === "PENDING" ? "secondary" : "destructive"} className={p.status === "CONFIRMED" ? "bg-brand-success text-white border-transparent" : ""}>
                        {p.status}
                      </Badge>
                    </td>
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
