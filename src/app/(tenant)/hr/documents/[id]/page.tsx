/** /hr/documents/[id] — Document detail + full lifecycle actions */
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle } from "lucide-react";
import { getStatusLabel } from "@/lib/status-labels";
import { displayDocumentType } from "@/lib/locale-display";
import { getLocaleCode } from "@/lib/locale";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE" || session.role === "BRANCH_MANAGER") return null;
  const { id } = await params;
  const tid = session.tenantId;
  const t = await getTranslations("hrDocuments");
  const tc = await getTranslations("common");
  const locale = await getLocaleCode();

  const doc = await db.employeeDocument.findFirst({
    where: { id, companyId: tid },
    include: {
      employee: { select: { id: true, fullName: true, employeeCode: true, branch: { select: { name: true } }, department: { select: { name: true } } } },
    },
  });
  if (!doc) notFound();

  const canManage = hasPerm(session.role, "MANAGE_DOCUMENTS");
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const isExpiring = doc.status === "VALID" && doc.expiryDate && new Date(doc.expiryDate) <= thirtyDays;

  const statusColor = (status: string) => {
    switch (status) {
      case "VALID": return "bg-brand-success text-white border-transparent";
      case "EXPIRED": return "bg-destructive/10 text-destructive border-destructive/20";
      case "MISSING": return "bg-destructive/10 text-destructive border-destructive/20";
      case "PENDING_REVIEW": return "bg-amber-50 text-amber-600 border-amber-200";
      case "REJECTED": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "";
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/documents" className="text-xs text-muted-foreground hover:text-foreground">{t("backToDocuments")}</Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">{displayDocumentType(doc.documentType, locale)}</h1>
            <p className="text-sm text-muted-foreground">{doc.employee.fullName} ({doc.employee.employeeCode})</p>
          </div>
          <Badge variant={doc.status === "VALID" ? "default" : "outline"} className={`text-xs ${statusColor(doc.status)}`}>{getStatusLabel(doc.status, locale)}</Badge>
        </div>
      </div>

      {isExpiring && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-medium text-amber-700">{t("expiresSoonWarning", { date: doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : "—" })}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("documentNumber")}</p>
          <p className="text-sm font-semibold text-foreground">{doc.documentNumber ?? "—"}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("branchLabel")}</p>
          <p className="text-sm font-semibold text-foreground">{doc.employee.branch?.name ?? "—"}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("issueDate")}</p>
          <p className="text-sm font-semibold text-foreground">{doc.issueDate ? new Date(doc.issueDate).toLocaleDateString() : "—"}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("expiryDate")}</p>
          <p className="text-sm font-semibold text-foreground">
            {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : "—"}
            {isExpiring && <span className="ml-2 text-xs text-amber-600 font-medium">{t("expiringSoonBadge")}</span>}
          </p>
        </Card>
      </div>

      {doc.notes && (
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-foreground">{t("notesCard")}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{doc.notes}</p></CardContent>
        </Card>
      )}

      {canManage && (
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("actionsCard")}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {doc.status === "PENDING_REVIEW" && (
              <>
                <form action={async () => {
                  "use server";
                  const { updateDocumentAction } = await import("../../actions");
                  await updateDocumentAction(doc.id, { status: "VALID" });
                }}>
                  <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-success px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-success/90">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {t("approveValid")}
                  </button>
                </form>
                <form action={async () => {
                  "use server";
                  const { updateDocumentAction } = await import("../../actions");
                  await updateDocumentAction(doc.id, { status: "REJECTED" });
                }}>
                  <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5">
                    <XCircle className="h-3.5 w-3.5" /> {tc("reject")}
                  </button>
                </form>
              </>
            )}
            {doc.status === "VALID" && (
              <form action={async () => {
                "use server";
                const { markDocumentExpiredAction } = await import("../../actions");
                await markDocumentExpiredAction(doc.id);
              }}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50">
                  <AlertTriangle className="h-3.5 w-3.5" /> {t("markExpired")}
                </button>
              </form>
            )}
            {doc.status !== "MISSING" && (
              <form action={async () => {
                "use server";
                const { markDocumentMissingAction } = await import("../../actions");
                await markDocumentMissingAction(doc.id);
              }}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
                  <HelpCircle className="h-3.5 w-3.5" /> {t("markMissing")}
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
