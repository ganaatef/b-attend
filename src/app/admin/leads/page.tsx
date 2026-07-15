/** /admin/leads */
import Link from "next/link";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { LeadBadge } from "@/components/badges/StatusBadges";
import { LeadRowActions } from "./LeadRowActions";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const where: any = params.status ? { status: params.status } : {};
  const [leads, platformUsers] = await Promise.all([
    db.lead.findMany({ where, include: { assignedTo: true, tenant: true }, orderBy: { createdAt: "desc" } }),
    db.platformUser.findMany({ where: { status: "ACTIVE", role: { in: ["SUPER_ADMIN", "SALES_ADMIN"] } } }),
  ]);
  const statusFilters = ["ALL", "NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">Leads</h1>
        <p className="text-sm text-muted-foreground">{leads.length} leads from /contact, /request-demo, and /signup.</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {statusFilters.map((s) => {
          const active = (params.status ?? "ALL") === s || (s === "ALL" && !params.status);
          return (
            <Link key={s} href={s === "ALL" ? "/admin/leads" : `/admin/leads?status=${s}`} className={`rounded-md px-3 py-1.5 text-xs font-medium ${active ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"}`}>
              {s}
            </Link>
          );
        })}
      </div>
      <Card className="border-border">
        {leads.length === 0 ? <EmptyState title="No leads yet" description="Leads from the public contact/demo forms will appear here." icon={Users} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Lead</th>
                  <th className="px-4 py-3 text-left font-medium">Company</th>
                  <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">Source</th>
                  <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">Size</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.email ?? "—"} · {l.phone ?? "—"}</p>
                      {l.tenant && <Link href={`/admin/tenants/${l.tenantId}`} className="text-xs text-brand-accent hover:underline">→ Tenant</Link>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{l.company ?? "—"}</td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">{l.sourcePage.replace(/_/g, " ")}</td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">{l.employeesCount ?? "—"} emp · {l.branchesCount ?? "—"} br</td>
                    <td className="px-4 py-3"><LeadBadge status={l.status} /></td>
                    <td className="px-4 py-3"><LeadRowActions leadId={l.id} status={l.status} platformUsers={platformUsers} /></td>
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
