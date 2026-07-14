/** /admin/invoices */
import Link from "next/link";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { InvoiceBadge } from "@/components/badges/StatusBadges";
import { InvoiceActions } from "./InvoiceActions";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { CreditCard } from "lucide-react";

export const dynamic = "force-dynamic";

function money(amount: number, currency = "EGP") { return `${amount.toLocaleString()} ${currency}`; }

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const where: any = params.status ? { status: params.status } : {};
  const invoices = await db.invoice.findMany({
    where,
    include: { tenant: true, plan: true },
    orderBy: { createdAt: "desc" },
  });

  const statusFilters = ["ALL", "DRAFT", "ISSUED", "PENDING_PAYMENT", "PAID", "OVERDUE", "VOID", "REFUNDED"];
  const totalPaid = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.total, 0);
  const totalOutstanding = invoices.filter((i) => i.status === "PENDING_PAYMENT" || i.status === "OVERDUE").reduce((s, i) => s + i.total, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">{invoices.length} invoices · {money(totalPaid)} paid · {money(totalOutstanding)} outstanding</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {statusFilters.map((s) => {
          const active = (params.status ?? "ALL") === s || (s === "ALL" && !params.status);
          return (
            <Link key={s} href={s === "ALL" ? "/admin/invoices" : `/admin/invoices?status=${s}`} className={`rounded-md px-3 py-1.5 text-xs font-medium ${active ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"}`}>
              {s.replace(/_/g, " ")}
            </Link>
          );
        })}
      </div>
      <Card className="border-border">
        {invoices.length === 0 ? <EmptyState title="No invoices" icon={CreditCard} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Invoice</th>
                  <th className="px-4 py-3 text-left font-medium">Tenant</th>
                  <th className="px-4 py-3 text-left font-medium">Total</th>
                  <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">Due date</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{inv.number}</p>
                      <p className="text-xs text-muted-foreground">{inv.plan?.name ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/tenants/${inv.tenantId}`} className="text-foreground hover:text-brand-accent">{inv.tenant.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{money(inv.total, inv.currency)}</td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3"><InvoiceBadge status={inv.status} /></td>
                    <td className="px-4 py-3">
                      {(inv.status === "PENDING_PAYMENT" || inv.status === "OVERDUE" || inv.status === "ISSUED") && <InvoiceActions invoiceId={inv.id} />}
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
