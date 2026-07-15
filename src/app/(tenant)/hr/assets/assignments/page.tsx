import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { hasHrPermission, getManagedBranchIds } from "@/lib/hr/permissions";
import { ArrowRightLeft, Plus, ArrowLeftRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AssetAssignmentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const tid = session.tenantId;
  const { status } = await searchParams;

  const canManage = await hasHrPermission("MANAGE_ASSETS");

  const isBranchManager = session.role === "BRANCH_MANAGER";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, tid) : [];
  const branchFilter = isBranchManager && managedBranchIds.length > 0 ? { employee: { branchId: { in: managedBranchIds } } } : {};

  const assignments = await db.assetAssignment.findMany({
    where: { companyId: tid, ...branchFilter, ...(status ? { status } : {}) },
    include: {
      asset: { select: { id: true, name: true, code: true, type: true } },
      employee: { select: { id: true, fullName: true, employeeCode: true } },
    },
    orderBy: { assignedAt: "desc" },
  });

  const allAssignments = await db.assetAssignment.findMany({
    where: { companyId: tid, ...branchFilter },
    select: { status: true },
  });

  const totalCount = allAssignments.length;
  const activeCount = allAssignments.filter((a) => a.status === "ASSIGNED").length;
  const returnedCount = allAssignments.filter((a) => a.status === "RETURNED").length;
  const lostCount = allAssignments.filter((a) => a.status === "LOST").length;
  const damagedCount = allAssignments.filter((a) => a.status === "DAMAGED").length;

  const statusColor = (s: string) => {
    switch (s) {
      case "ASSIGNED": return "bg-blue-50 text-blue-600 border-blue-200";
      case "RETURNED": return "bg-brand-success text-white border-transparent";
      case "LOST": return "bg-destructive/10 text-destructive border-destructive/20";
      case "DAMAGED": return "bg-amber-50 text-amber-600 border-amber-200";
      default: return "";
    }
  };

  const statusFilters = [
    { value: "", label: "All" },
    { value: "ASSIGNED", label: "Active" },
    { value: "RETURNED", label: "Returned" },
    { value: "LOST", label: "Lost" },
    { value: "DAMAGED", label: "Damaged" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Asset Assignments</h1>
          <p className="text-sm text-muted-foreground">{totalCount} total · {activeCount} active · {returnedCount} returned</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Link href="/hr/assets/assignments/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90">
              <Plus className="h-3.5 w-3.5" /> New Assignment
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{totalCount}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{activeCount}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{returnedCount}</p>
          <p className="text-xs text-muted-foreground">Returned</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{lostCount}</p>
          <p className="text-xs text-muted-foreground">Lost</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{damagedCount}</p>
          <p className="text-xs text-muted-foreground">Damaged</p>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        {statusFilters.map((sf) => (
          <Link
            key={sf.value}
            href={sf.value ? `/hr/assets/assignments?status=${sf.value}` : "/hr/assets/assignments"}
            className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              (status || "") === sf.value
                ? "bg-brand-accent text-white"
                : "border border-border bg-card text-foreground hover:bg-muted/40"
            }`}
          >
            {sf.label}
          </Link>
        ))}
      </div>

      <Card className="border-border">
        {assignments.length === 0 ? (
          <EmptyState title="No assignments" description="Assign assets to employees to track them" icon={ArrowLeftRight} />
        ) : (
          <div className="divide-y divide-border/60">
            {assignments.map((aa) => (
              <Link key={aa.id} href={`/hr/assets/${aa.asset.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{aa.asset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {aa.employee.fullName} ({aa.employee.employeeCode}) · Assigned {new Date(aa.assignedAt).toLocaleDateString()}
                      {aa.returnedAt && ` · Returned ${new Date(aa.returnedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <Badge variant={aa.status === "ASSIGNED" ? "default" : "outline"} className={`text-[10px] ${statusColor(aa.status)}`}>{aa.status}</Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
