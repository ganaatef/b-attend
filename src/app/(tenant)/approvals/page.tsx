/** /approvals — list of approval requests for managers/HR. */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { CheckSquare } from "lucide-react";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

const statusBadge = (s: string) => {
  if (s === "PENDING") return <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-transparent text-xs">{s}</Badge>;
  if (s === "APPROVED") return <Badge variant="default" className="bg-brand-success text-white border-transparent text-xs">{s}</Badge>;
  if (s === "REJECTED") return <Badge variant="destructive" className="text-xs">{s}</Badge>;
  return <Badge variant="outline" className="text-xs">{s}</Badge>;
};

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const t = await getTranslations("approvals");
  const params = await searchParams;
  const where: any = { companyId: session.tenantId };
  if (params.status) where.status = params.status;

  // Branch managers see only their branch
  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (user?.role === "BRANCH_MANAGER") {
    const managed = await db.branch.findMany({ where: { companyId: session.tenantId, managerId: user.id } });
    where.branchId = { in: managed.map((b) => b.id) };
  }

  const requests = await db.approvalRequest.findMany({
    where,
    include: { employee: true, branch: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const statuses = ["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div><h1 className="text-lg font-bold text-foreground">{t("title")}</h1><p className="text-sm text-muted-foreground">{t("requests", { count: requests.length })}</p></div>
      <div className="flex flex-wrap gap-1.5">
        {statuses.map((s) => {
          const active = (params.status ?? "ALL") === s || (s === "ALL" && !params.status);
          const label = s === "ALL" ? t("all") : s === "PENDING" ? t("pending") : s === "APPROVED" ? t("approved") : s === "REJECTED" ? t("rejected") : s === "CANCELLED" ? t("cancelled") : s;
          return <Link key={s} href={s === "ALL" ? "/approvals" : `/approvals?status=${s}`} className={`rounded-md px-3 py-1.5 text-xs font-medium ${active ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"}`}>{label}</Link>;
        })}
      </div>
      <Card className="border-border">
        {requests.length === 0 ? <EmptyState title={t("noApprovals")} icon={CheckSquare} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{t("employee")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("type")}</th>
                  <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">{t("date")}</th>
                  <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">{t("reason")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("status")}</th>
                  <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">{t("created")}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3"><Link href={`/employees/${r.employeeId}`} className="font-medium text-foreground hover:text-brand-accent">{r.employee?.fullName}</Link><p className="text-xs text-muted-foreground">{r.branch?.name ?? "—"}</p></td>
                    <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{r.type.replace(/_/g, " ")}</Badge></td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">{r.date ? new Date(r.date).toLocaleDateString() : "—"}</td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell max-w-xs truncate">{r.reason}</td>
                    <td className="px-4 py-3">{statusBadge(r.status)}</td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">{new Date(r.createdAt).toLocaleDateString()}</td>
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
