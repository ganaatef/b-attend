import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { resolveWarningAction, cancelWarningAction } from "../../actions";
import { AlertTriangle, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function WarningDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  const { id } = await params;
  const tid = session.tenantId;
  if (session.role === "EMPLOYEE") return null;

  const featureCheck = await canUseHrFeature(tid, "hr_core");
  if (!featureCheck.allowed) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
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

  const warning = await db.employeeWarning.findFirst({
    where: { id, companyId: tid },
    include: {
      employee: { select: { id: true, fullName: true, employeeCode: true, branch: { select: { name: true } }, department: { select: { name: true } } } },
    },
  });
  if (!warning) notFound();

  const issuedBy = warning.issuedById
    ? await db.user.findUnique({ where: { id: warning.issuedById }, select: { id: true, name: true, email: true } })
    : null;

  const canManage = hasPerm(session.role, "MANAGE_WARNINGS");
  const isActive = warning.status === "OPEN" || warning.status === "ACKNOWLEDGED";

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
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/warnings" className="text-xs text-muted-foreground hover:text-foreground">← Warnings</Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">{warning.type.replace(/_/g, " ")} Warning</h1>
            <p className="text-sm text-muted-foreground">{warning.employee.fullName} ({warning.employee.employeeCode})</p>
          </div>
          <div className="flex items-center gap-2">
            {severityBadge(warning.severity)}
            {statusBadge(warning.status)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">Employee</p>
          <p className="text-sm font-semibold text-foreground">{warning.employee.fullName}</p>
          <p className="text-[10px] text-muted-foreground">{warning.employee.employeeCode}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">Branch</p>
          <p className="text-sm font-semibold text-foreground">{warning.employee.branch?.name ?? "—"}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">Department</p>
          <p className="text-sm font-semibold text-foreground">{warning.employee.department?.name ?? "—"}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">Date</p>
          <p className="text-sm font-semibold text-foreground">{new Date(warning.date).toLocaleDateString()}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">Issued By</p>
          <p className="text-sm font-semibold text-foreground">{issuedBy?.name ?? "—"}</p>
          {issuedBy?.email && <p className="text-[10px] text-muted-foreground">{issuedBy.email}</p>}
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">Created</p>
          <p className="text-sm font-semibold text-foreground">{new Date(warning.createdAt).toLocaleDateString()}</p>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-foreground">Reason</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{warning.reason}</p></CardContent>
      </Card>

      {warning.actionTaken && (
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-foreground">Action Taken</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{warning.actionTaken}</p></CardContent>
        </Card>
      )}

      {warning.notes && (
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-foreground">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{warning.notes}</p></CardContent>
        </Card>
      )}

      {warning.acknowledgedByEmployee && (
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-foreground">Acknowledgment</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">Acknowledged by employee</p>
            {warning.acknowledgedAt && (
              <p className="text-xs text-muted-foreground">On {new Date(warning.acknowledgedAt).toLocaleDateString()}</p>
            )}
          </CardContent>
        </Card>
      )}

      {canManage && isActive && (
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Actions</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <form action={async () => { "use server"; await resolveWarningAction(warning.id); }}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                Resolve
              </button>
            </form>
            <form action={async () => { "use server"; await cancelWarningAction(warning.id); }}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5">
                Cancel Warning
              </button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
