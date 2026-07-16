import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Package } from "lucide-react";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function MyAssetsPage() {
  const t = await getTranslations("myAssets");
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;

  const user = await db.user.findUnique({ where: { id: session.sub }, include: { employee: true } });
  const employee = user?.employee;

  if (!employee) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Card>
          <CardContent className="py-6">
            <p className="text-center text-sm text-muted-foreground">{t("noLinkedEmployee")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const employeeId = employee.id;

  const assetAssignments = await db.assetAssignment.findMany({
    where: { employeeId, companyId: session.tenantId },
    include: { asset: true },
    orderBy: { assignedAt: "desc" },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "ASSIGNED":
        return <Badge variant="default">{t("assigned")}</Badge>;
      case "RETURNED":
        return <Badge variant="outline">{t("returned")}</Badge>;
      case "LOST":
        return <Badge variant="destructive">{t("lost")}</Badge>;
      case "DAMAGED":
        return <Badge variant="destructive">{t("damaged")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">My Assets</h1>
        <p className="text-sm text-muted-foreground">View assets and uniforms assigned to you.</p>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">{t("assignedAssets", { count: assetAssignments.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {assetAssignments.length === 0 ? (
            <EmptyState title={t("noAssetsAssigned")} icon={Package} />
          ) : (
            <div className="divide-y divide-border/60">
              {assetAssignments.map((aa) => (
                <div key={aa.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{aa.asset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {aa.asset.code} · {aa.asset.type}
                        {` · ${t("assignedOn")} ${new Date(aa.assignedAt).toLocaleDateString()}`}
                        {aa.returnedAt && ` · ${t("returnedOn")} ${new Date(aa.returnedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  {statusBadge(aa.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
