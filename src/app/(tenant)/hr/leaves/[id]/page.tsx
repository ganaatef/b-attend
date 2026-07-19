/** /hr/leaves/[id] — Leave request detail + approve/reject actions */
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { approveLeaveRequestAction, rejectLeaveRequestAction, cancelLeaveRequestAction } from "../../actions";
import { CalendarDays, Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function LeaveRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("hrLeaves");
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const { id } = await params;
  const tid = session.tenantId;

  const featureCheck = await canUseHrFeature(tid, "hr_leave");
  if (!featureCheck.allowed) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="border-dashed border-amber-300 bg-amber-50/40">
          <div className="pt-6 pb-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-amber-500" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">{t("featureGateTitle")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{featureCheck.reason ?? t("upgradeMessage")}</p>
          </div>
        </Card>
      </div>
    );
  }

  const lr = await db.leaveRequest.findFirst({
    where: { id, companyId: tid },
    include: {
      employee: { select: { id: true, fullName: true, employeeCode: true, branch: { select: { name: true } }, department: { select: { name: true } } } },
      leaveType: true,
    },
  });
  if (!lr) notFound();

  const canApprove = hasPerm(session.role, "APPROVE_LEAVE");
  const statusColor = (status: string) => {
    switch (status) {
      case "APPROVED": return "bg-brand-success text-white border-transparent";
      case "REJECTED": return "bg-destructive/10 text-destructive border-destructive/20";
      case "PENDING": return "bg-amber-50 text-amber-600 border-amber-200";
      case "CANCELLED": return "bg-muted text-muted-foreground border-border";
      default: return "";
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/leaves" className="text-xs text-muted-foreground hover:text-foreground">{t("backToLeave")}</Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">{t("leaveRequest")}</h1>
            <p className="text-sm text-muted-foreground">{lr.employee.fullName} ({lr.employee.employeeCode})</p>
          </div>
          <Badge variant={lr.status === "APPROVED" ? "default" : "outline"} className={`text-xs ${statusColor(lr.status)}`}>{lr.status}</Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("leaveType")}</p>
          <p className="text-sm font-semibold text-foreground">{lr.leaveType.name} ({lr.leaveType.code})</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("paid")}</p>
          <p className="text-sm font-semibold text-foreground">{lr.leaveType.paid ? t("yes") : t("no")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("startDate")}</p>
          <p className="text-sm font-semibold text-foreground">{new Date(lr.startDate).toLocaleDateString()}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("endDate")}</p>
          <p className="text-sm font-semibold text-foreground">{new Date(lr.endDate).toLocaleDateString()}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("daysCount")}</p>
          <p className="text-sm font-semibold text-foreground">{lr.daysCount}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("branch")}</p>
          <p className="text-sm font-semibold text-foreground">{lr.employee.branch?.name ?? "—"}</p>
        </Card>
      </div>

      {lr.reason && (
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-foreground">{t("reason")}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{lr.reason}</p></CardContent>
        </Card>
      )}

      {lr.managerNotes && (
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-foreground">{t("managerNotes")}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{lr.managerNotes}</p></CardContent>
        </Card>
      )}

      {canApprove && lr.status === "PENDING" && (
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("actions")}</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <form action={async () => { "use server"; await approveLeaveRequestAction(lr.id); }}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-success px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-success/90">
                {t("approve")}
              </button>
            </form>
            <form action={async () => { "use server"; await rejectLeaveRequestAction(lr.id); }}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5">
                {t("reject")}
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      {(lr.status === "PENDING" || lr.status === "APPROVED") && (
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("cancelRequest")}</CardTitle></CardHeader>
          <CardContent>
            <form action={async () => { "use server"; await cancelLeaveRequestAction(lr.id); }}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
                {t("cancelRequest")}
              </button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
