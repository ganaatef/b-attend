import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { returnAssetAction, markAssetLostAction, markAssetDamagedAction, retireAssetAction } from "../../actions";
import { Package, ArrowLeft, ArrowRightLeft } from "lucide-react";
import { AssignAssetForm } from "./AssignAssetForm";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("hrAssets");
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const { id } = await params;
  const tid = session.tenantId;

  const asset = await db.asset.findFirst({
    where: { id, companyId: tid },
    include: {
      assignments: {
        include: {
          employee: { select: { id: true, fullName: true, employeeCode: true } },
        },
        orderBy: { assignedAt: "desc" },
      },
    },
  });
  if (!asset) notFound();

  const canManage = hasPerm(session.role, "MANAGE_ASSETS");
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

  const latestAssignment = asset.assignments.find((a) => a.status === "ASSIGNED") ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/assets" className="text-xs text-muted-foreground hover:text-foreground">{t("backToAssets")}</Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">{asset.name}</h1>
            <p className="text-sm text-muted-foreground">{asset.code ?? t("noCode")} · {asset.type}</p>
          </div>
          <Badge variant={asset.status === "AVAILABLE" ? "default" : "outline"} className={`text-[10px] ${statusColor(asset.status)}`}>{asset.status}</Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("statusLabel")}</p>
          <p className="text-sm font-semibold text-foreground">{asset.status}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("typeLabel")}</p>
          <p className="text-sm font-semibold text-foreground">{asset.type}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("purchaseDate")}</p>
          <p className="text-sm font-semibold text-foreground">{asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString() : "—"}</p>
        </Card>
      </div>

      {asset.notes && (
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-foreground">{t("notesCard")}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{asset.notes}</p></CardContent>
        </Card>
      )}

      {canManage && asset.status === "AVAILABLE" && (
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("assignAsset")}</CardTitle></CardHeader>
          <CardContent>
            <AssignAssetForm assetId={asset.id} />
          </CardContent>
        </Card>
      )}

      {canManage && latestAssignment && (
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("currentAssignment")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{latestAssignment.employee.fullName} ({latestAssignment.employee.employeeCode})</p>
                <p className="text-xs text-muted-foreground">
                  {t("assignedPrefix")} {new Date(latestAssignment.assignedAt).toLocaleDateString()}
                  {latestAssignment.conditionOnAssign && ` · ${t("conditionLabel")} ${latestAssignment.conditionOnAssign}`}
                </p>
              </div>
              <Badge variant="default" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200">{t("assignedBadge")}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={async () => { "use server"; await returnAssetAction(latestAssignment.id); }}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-success px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-success/90">
                  {t("returnBtn")}
                </button>
              </form>
              <form action={async () => { "use server"; await markAssetLostAction(latestAssignment.id); }}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5">
                  {t("markLost")}
                </button>
              </form>
              <form action={async () => { "use server"; await markAssetDamagedAction(latestAssignment.id); }}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50">
                  {t("markDamaged")}
                </button>
              </form>
            </div>
          </CardContent>
        </Card>
      )}

      {canManage && asset.status === "AVAILABLE" && !latestAssignment && (
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("actions")}</CardTitle></CardHeader>
          <CardContent>
            <form action={async () => { "use server"; await retireAssetAction(asset.id); }}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
                {t("retireAsset")}
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("assignmentHistory", { count: asset.assignments.length })}</CardTitle></CardHeader>
        <CardContent>
          {asset.assignments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">{t("noAssignmentHistory")}</p>
          ) : (
            <div className="divide-y divide-border/60">
              {asset.assignments.map((aa) => (
                <div key={aa.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{aa.employee.fullName} ({aa.employee.employeeCode})</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(aa.assignedAt).toLocaleDateString()}
                        {aa.returnedAt && ` — ${new Date(aa.returnedAt).toLocaleDateString()}`}
                        {aa.conditionOnAssign && ` · ${t("outLabel")} ${aa.conditionOnAssign}`}
                        {aa.conditionOnReturn && ` · ${t("inLabel")} ${aa.conditionOnReturn}`}
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
    </div>
  );
}
