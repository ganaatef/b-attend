import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { AlertTriangle, Eye, Plus, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function WarningsListPage({ searchParams }: { searchParams: Promise<{ branch?: string; severity?: string; status?: string }> }) {
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
            <h3 className="mt-2 text-sm font-semibold text-foreground">HR Module requires Starter plan or higher</h3>
            <p className="mt-1 text-xs text-muted-foreground">{featureCheck.reason ?? "Upgrade to access HR features."}</p>
          </div>
        </Card>
      </div>
    );
  }

  const sp = await searchParams;
  const canManage = hasPerm(session.role, "MANAGE_WARNINGS");
  const isBranchManager = session.role === "BRANCH_MANAGER";

  let managedBranchIds: string[] = [];
  if (isBranchManager) {
    const { getManagedBranchIds } = await import("@/lib/hr/permissions");
    managedBranchIds = await getManagedBranchIds(session.sub, tid);
  }

  const where: any = { companyId: tid };

  if (isBranchManager && managedBranchIds.length > 0) {
    where.branchId = sp.branch && managedBranchIds.includes(sp.branch) ? sp.branch : { in: managedBranchIds };
  } else if (sp.branch) {
    where.branchId = sp.branch;
  }

  if (sp.severity) {
    where.severity = sp.severity;
  }

  if (sp.status) {
    where.status = sp.status;
  }

  const [warnings, branches, totals, openCount, ackCount, resolvedCount, criticalCount] = await Promise.all([
    db.employeeWarning.findMany({
      where,
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true, branch: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.branch.findMany({ where: { companyId: tid, deletedAt: null }, orderBy: { name: "asc" } }),
    db.employeeWarning.count({ where: { companyId: tid } }),
    db.employeeWarning.count({ where: { companyId: tid, status: "OPEN" } }),
    db.employeeWarning.count({ where: { companyId: tid, status: "ACKNOWLEDGED" } }),
    db.employeeWarning.count({ where: { companyId: tid, status: "RESOLVED" } }),
    db.employeeWarning.count({ where: { companyId: tid, severity: "CRITICAL" } }),
  ]);

  const severityBadge = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
      case "HIGH":
        return <Badge variant="destructive" className="text-[10px]">{sev}</Badge>;
      case "MEDIUM":
        return <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">{sev}</Badge>;
      case "LOW":
        return <Badge variant="default" className="text-[10px]">{sev}</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{sev}</Badge>;
    }
  };

  const statusBadge = (st: string) => {
    switch (st) {
      case "OPEN":
        return <Badge variant="outline" className="text-[10px]">{st}</Badge>;
      case "ACKNOWLEDGED":
        return <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200">{st}</Badge>;
      case "RESOLVED":
        return <Badge variant="default" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200">{st}</Badge>;
      case "CANCELLED":
        return <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">{st}</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{st}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Employee Warnings</h1>
          <p className="text-sm text-muted-foreground">{openCount} open · {ackCount} acknowledged · {criticalCount} critical</p>
        </div>
        {canManage && (
          <Link href="/hr/warnings/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90">
            <Plus className="h-3.5 w-3.5" /> New Warning
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{totals}</p>
          <p className="text-xs text-muted-foreground">Total Warnings</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{openCount}</p>
          <p className="text-xs text-muted-foreground">Open</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{ackCount}</p>
          <p className="text-xs text-muted-foreground">Acknowledged</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{resolvedCount}</p>
          <p className="text-xs text-muted-foreground">Resolved</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{criticalCount}</p>
          <p className="text-xs text-muted-foreground">Critical Severity</p>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <form method="GET" action="/hr/warnings" className="flex flex-wrap items-end gap-2">
            <CardTitle className="text-sm font-semibold text-foreground mr-2 mb-1">Filters</CardTitle>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Branch</label>
              <select name="branch" defaultValue={sp.branch || ""} className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs">
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Severity</label>
              <select name="severity" defaultValue={sp.severity || ""} className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs">
                <option value="">All Severity</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Status</label>
              <select name="status" defaultValue={sp.status || ""} className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs">
                <option value="">All Status</option>
                <option value="OPEN">Open</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <button type="submit" className="h-8 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted/40">Apply</button>
          </form>
        </CardHeader>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Warnings ({warnings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {warnings.length === 0 ? (
            <EmptyState title="No warnings found" icon={AlertTriangle} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="pb-2 pr-4">Employee</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Severity</th>
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {warnings.map((w) => (
                    <tr key={w.id} className="text-foreground">
                      <td className="py-3 pr-4">
                        <p className="font-medium">{w.employee.fullName}</p>
                        <p className="text-[10px] text-muted-foreground">{w.employee.employeeCode} · {w.employee.branch?.name ?? "—"}</p>
                      </td>
                      <td className="py-3 pr-4 text-xs">{w.type.replace(/_/g, " ")}</td>
                      <td className="py-3 pr-4">{severityBadge(w.severity)}</td>
                      <td className="py-3 pr-4 text-xs">{new Date(w.date).toLocaleDateString()}</td>
                      <td className="py-3 pr-4">{statusBadge(w.status)}</td>
                      <td className="py-3 text-right">
                        <Link href={`/hr/warnings/${w.id}`} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-foreground hover:bg-muted/40">
                          <Eye className="h-3 w-3" /> View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
