/** /branches */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Building2, Plus, MapPin } from "lucide-react";
import { BranchForm } from "./BranchForm";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  const t = await getTranslations("branches");
  const session = await getSession();
  if (!session?.tenantId) return null;
  const branches = await db.branch.findMany({
    where: { companyId: session.tenantId, deletedAt: null },
    include: { _count: { select: { employees: true, schedules: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("count", { count: branches.length })}</p>
        </div>
      </div>
      <Card className="border-border p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t("addNewBranch")}</h2>
        <BranchForm />
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3"><EmptyState title={t("noBranches")} description={t("noBranchesDesc")} icon={Building2} /></div>
        ) : branches.map((b) => (
          <Card key={b.id} className="border-border p-4">
            <div className="flex items-start justify-between">
              <div>
                <Link href={`/branches/${b.id}`} className="font-medium text-foreground hover:text-brand-accent">{b.name}</Link>
                <p className="text-xs text-muted-foreground">{b.code}</p>
              </div>
              <Badge variant="outline" className="text-xs">{b.status}</Badge>
            </div>
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> {b.address ?? b.city ?? t("noAddress")}
            </p>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("employeesCount", { count: b._count.employees })}</span>
              <span>{t("schedulesCount", { count: b._count.schedules })}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t("geofence", { radius: b.geofenceRadius })} · {b.latitude && b.longitude ? `${b.latitude.toFixed(4)}, ${b.longitude.toFixed(4)}` : t("noCoordinates")}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
