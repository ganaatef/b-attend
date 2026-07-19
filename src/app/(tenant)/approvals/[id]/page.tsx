/** /approvals/[id] — detail + approve/reject form */
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DecideForm } from "./DecideForm";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { formatDateTime } from "@/lib/utils";
import { getTranslations, getLocale } from "next-intl/server";
import { getStatusLabel } from "@/lib/status-labels";

export const dynamic = "force-dynamic";

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("approvals");
  const locale = await getLocale();
  const session = await getSession();
  if (!session?.tenantId) return null;
  const { id } = await params;
  const req = await db.approvalRequest.findFirst({
    where: { id, companyId: session.tenantId },
    include: { employee: { include: { branch: true } }, branch: true },
  });
  if (!req) notFound();

  const canDecide = session.role === "COMPANY_OWNER" || session.role === "HR_ADMIN" || session.role === "BRANCH_MANAGER";
  const punches = req.employee ? await db.punch.findMany({
    where: { employeeId: req.employeeId, timestamp: { gte: req.date ?? new Date(0), lt: req.date ? new Date(new Date(req.date).getTime() + 86400000) : new Date(Date.now() + 86400000) } },
    orderBy: { timestamp: "asc" },
  }) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/approvals" className="text-xs text-muted-foreground hover:text-foreground">← {t("backToApprovals")}</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">{req.type.replace(/_/g, " ")}</h1>
        <p className="text-sm text-muted-foreground">{req.employee?.fullName} · {req.employee?.employeeCode}</p>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant={req.status === "PENDING" ? "secondary" : req.status === "APPROVED" ? "default" : req.status === "REJECTED" ? "destructive" : "outline"} className={req.status === "PENDING" ? "bg-amber-100 text-amber-800 border-transparent text-xs" : req.status === "APPROVED" ? "bg-brand-success text-white border-transparent text-xs" : "text-xs"}>{getStatusLabel(req.status, locale)}</Badge>
          {req.date && <span className="text-xs text-muted-foreground">{t("forLabel")} {new Date(req.date).toLocaleDateString()}</span>}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("requestDetails")}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">{t("employeeLabel")}</span> <span className="font-medium text-foreground">{req.employee?.fullName}</span></div>
          <div><span className="text-muted-foreground">{t("branchLabel")}</span> <span className="font-medium text-foreground">{req.branch?.name ?? "—"}</span></div>
          <div><span className="text-muted-foreground">{t("reasonLabel")}</span> <span className="text-foreground">{req.reason}</span></div>
          {req.requestedData && <div><span className="text-muted-foreground">{t("requestedLabel")}</span> <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{req.requestedData}</code></div>}
          <div><span className="text-muted-foreground">{t("requestedByLabel")}</span> <span className="text-foreground">{req.requestedById ?? "—"}</span></div>
          <div><span className="text-muted-foreground">{t("createdLabel")}</span> <span className="text-foreground">{formatDateTime(req.createdAt)}</span></div>
          {req.managerNotes && <div><span className="text-muted-foreground">{t("managerNotesLabel")}</span> <span className="text-foreground">{req.managerNotes}</span></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("punchesOnDate")}</CardTitle></CardHeader>
        <CardContent>
          {punches.length === 0 ? <EmptyState title={t("noPunches")} /> : (
            <div className="space-y-1.5">
              {punches.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-md border border-border/60 bg-card px-3 py-2 text-xs">
                  <span className="font-medium text-foreground">{p.type.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">{new Date(p.timestamp).toLocaleTimeString()} · {p.source} · {p.insideGeofence ? t("inLabel") : t("outLabel")}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canDecide && req.status === "PENDING" && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("decisionCard")}</CardTitle></CardHeader>
          <CardContent><DecideForm requestId={req.id} /></CardContent>
        </Card>
      )}
    </div>
  );
}
