/** /hr/contracts — Employee Contracts list with CRUD + Excel export */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { hasHrPermission } from "@/lib/hr/permissions";
import { FileText, Download, Lock, Plus, AlertTriangle, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HrContractsPage() {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE" || session.role === "BRANCH_MANAGER") return null;
  const tid = session.tenantId;

  const featureCheck = await canUseHrFeature(tid, "hr_core");
  if (!featureCheck.allowed) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Card className="border-dashed border-amber-300 bg-amber-50/40">
          <div className="pt-6 pb-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-amber-500" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">HR Module requires Growth plan or higher</h3>
            <p className="mt-1 text-xs text-muted-foreground">{featureCheck.reason ?? "Upgrade to access HR features."}</p>
          </div>
        </Card>
      </div>
    );
  }

  const canManage = await hasHrPermission("MANAGE_CONTRACTS");
  const canExport = await hasHrPermission("EXPORT_HR_EXCEL");

  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);

  const [contracts, stats] = await Promise.all([
    db.employeeContract.findMany({
      where: { companyId: tid },
      include: { employee: { select: { id: true, fullName: true, employeeCode: true, branch: { select: { name: true } } } } },
      orderBy: { startDate: "desc" },
    }),
    db.employeeContract.aggregate({
      where: { companyId: tid },
      _count: true,
    }),
  ]);

  const activeCount = contracts.filter((c) => c.status === "ACTIVE").length;
  const expiringCount = contracts.filter((c) => c.status === "ACTIVE" && c.endDate && new Date(c.endDate) <= thirtyDays).length;
  const expiredCount = contracts.filter((c) => c.status === "EXPIRED").length;

  const statusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-brand-success text-white border-transparent";
      case "EXPIRED": return "bg-destructive/10 text-destructive border-destructive/20";
      case "TERMINATED": return "bg-destructive/10 text-destructive border-destructive/20";
      case "DRAFT": return "bg-muted text-muted-foreground border-border";
      case "RENEWED": return "bg-blue-50 text-blue-600 border-blue-200";
      default: return "";
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Contracts</h1>
          <p className="text-sm text-muted-foreground">{contracts.length} total · {activeCount} active · {expiringCount} expiring within 30 days</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <Link href="/api/tenant/hr/contracts/excel" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
              <Download className="h-3.5 w-3.5" /> Export Excel
            </Link>
          )}
          {canManage && (
            <Link href="/hr/contracts/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90">
              <Plus className="h-3.5 w-3.5" /> New Contract
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{activeCount}</p>
          <p className="text-xs text-muted-foreground">Active contracts</p>
        </Card>
        <Card className={`border-border p-4 ${expiringCount > 0 ? "border-amber-300 bg-amber-50/40" : ""}`}>
          <p className="text-2xl font-bold text-foreground">{expiringCount}</p>
          <p className="text-xs text-muted-foreground">Expiring in 30 days</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{expiredCount}</p>
          <p className="text-xs text-muted-foreground">Expired</p>
        </Card>
      </div>

      <Card className="border-border">
        {contracts.length === 0 ? (
          <EmptyState title="No contracts" description="Create your first employee contract" icon={FileText} />
        ) : (
          <div className="divide-y divide-border/60">
            {contracts.map((c) => {
              const isExpiring = c.status === "ACTIVE" && c.endDate && new Date(c.endDate) <= thirtyDays;
              return (
                <Link key={c.id} href={`/hr/contracts/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isExpiring ? "bg-amber-100" : "bg-muted"}`}>
                      <FileText className={`h-4 w-4 ${isExpiring ? "text-amber-600" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{c.contractNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.employee.fullName} ({c.employee.employeeCode}) · {c.contractType.replace(/_/g, " ")}
                        {c.employee.branch ? ` · ${c.employee.branch.name}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{new Date(c.startDate).toLocaleDateString()} — {c.endDate ? new Date(c.endDate).toLocaleDateString() : "Open"}</p>
                      {isExpiring && <p className="flex items-center gap-1 text-amber-600 font-medium"><AlertTriangle className="h-3 w-3" /> Expiring soon</p>}
                    </div>
                    <Badge variant={c.status === "ACTIVE" ? "default" : "outline"} className={`text-[10px] ${statusColor(c.status)}`}>{c.status}</Badge>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
