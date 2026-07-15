import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { hasHrPermission, getManagedBranchIds } from "@/lib/hr/permissions";
import { Package, Lock, Plus, Eye, ArrowRightLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HrAssetsPage({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string }> }) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const tid = session.tenantId;
  const { tab, status } = await searchParams;

  const featureCheck = await canUseHrFeature(tid, "hr_assets");
  if (!featureCheck.allowed) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Card className="border-dashed border-amber-300 bg-amber-50/40">
          <div className="pt-6 pb-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-amber-500" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">Asset Management requires Growth plan or higher</h3>
            <p className="mt-1 text-xs text-muted-foreground">{featureCheck.reason ?? "Upgrade to access asset management."}</p>
          </div>
        </Card>
      </div>
    );
  }

  const canManage = await hasHrPermission("MANAGE_ASSETS");
  const isBranchManager = session.role === "BRANCH_MANAGER";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, tid) : [];

  const branchFilter = isBranchManager && managedBranchIds.length > 0
    ? { assignments: { some: { employee: { branchId: { in: managedBranchIds } } } } }
    : {};

  const [assets, assignments] = await Promise.all([
    db.asset.findMany({
      where: { companyId: tid, ...branchFilter },
      orderBy: { createdAt: "desc" },
    }),
    db.assetAssignment.findMany({
      where: { companyId: tid, ...(isBranchManager && managedBranchIds.length > 0 ? { employee: { branchId: { in: managedBranchIds } } } : {}) },
      include: {
        asset: { select: { id: true, name: true, code: true, type: true } },
        employee: { select: { id: true, fullName: true, employeeCode: true } },
      },
      orderBy: { assignedAt: "desc" },
    }),
  ]);

  const totalCount = assets.length;
  const availableCount = assets.filter((a) => a.status === "AVAILABLE").length;
  const assignedCount = assets.filter((a) => a.status === "ASSIGNED").length;
  const lostCount = assets.filter((a) => a.status === "LOST").length;
  const damagedCount = assets.filter((a) => a.status === "DAMAGED").length;
  const retiredCount = assets.filter((a) => a.status === "RETIRED").length;

  const statusColor = (s: string) => {
    switch (s) {
      case "AVAILABLE": return "bg-brand-success text-white border-transparent";
      case "ASSIGNED": return "bg-blue-50 text-blue-600 border-blue-200";
      case "LOST": return "bg-destructive/10 text-destructive border-destructive/20";
      case "DAMAGED": return "bg-amber-50 text-amber-600 border-amber-200";
      case "RETIRED": return "bg-muted text-muted-foreground border-border";
      default: return "";
    }
  };

  const filteredAssignments = status
    ? assignments.filter((a) => a.status === status)
    : assignments;

  const activeAssignments = assignments.filter((a) => a.status === "ASSIGNED").length;
  const returnedAssignments = assignments.filter((a) => a.status === "RETURNED").length;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Assets & Uniforms</h1>
          <p className="text-sm text-muted-foreground">{totalCount} total assets · {availableCount} available · {activeAssignments} assigned</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <Link href="/hr/assets/assignments/new" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
                <ArrowRightLeft className="h-3.5 w-3.5" /> New Assignment
              </Link>
              <Link href="/hr/assets/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90">
                <Plus className="h-3.5 w-3.5" /> Add Asset
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-6">
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{totalCount}</p>
          <p className="text-xs text-muted-foreground">Total assets</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{availableCount}</p>
          <p className="text-xs text-muted-foreground">Available</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{assignedCount}</p>
          <p className="text-xs text-muted-foreground">Assigned</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{lostCount}</p>
          <p className="text-xs text-muted-foreground">Lost</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{damagedCount}</p>
          <p className="text-xs text-muted-foreground">Damaged</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{retiredCount}</p>
          <p className="text-xs text-muted-foreground">Retired</p>
        </Card>
      </div>

      <Tabs defaultValue={tab || "catalog"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">Asset Catalog</CardTitle>
                {canManage && (
                  <Link href="/hr/assets/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90">
                    <Plus className="h-3.5 w-3.5" /> Add Asset
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {assets.length === 0 ? (
                <EmptyState title="No assets" description="Add assets to track company equipment" icon={Package} />
              ) : (
                <div className="divide-y divide-border/60">
                  {assets.map((a) => (
                    <Link key={a.id} href={`/hr/assets/${a.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{a.name}</p>
                          <p className="text-xs text-muted-foreground">{a.code ?? "—"} · {a.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={a.status === "AVAILABLE" ? "default" : "outline"} className={`text-[10px] ${statusColor(a.status)}`}>{a.status}</Badge>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">Assignments ({filteredAssignments.length})</CardTitle>
                {canManage && (
                  <Link href="/hr/assets/assignments/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90">
                    <Plus className="h-3.5 w-3.5" /> New Assignment
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredAssignments.length === 0 ? (
                <EmptyState title="No assignments" description="Assign assets to employees" icon={ArrowRightLeft} />
              ) : (
                <div className="divide-y divide-border/60">
                  {filteredAssignments.map((aa) => (
                    <div key={aa.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{aa.asset.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {aa.employee.fullName} ({aa.employee.employeeCode}) · {new Date(aa.assignedAt).toLocaleDateString()}
                            {aa.returnedAt && ` · Returned ${new Date(aa.returnedAt).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <Badge variant={aa.status === "ASSIGNED" ? "default" : "outline"} className={`text-[10px] ${statusColor(aa.status)}`}>{aa.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
