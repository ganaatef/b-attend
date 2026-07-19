/** /hr/documents — Employee Documents list with CRUD + Excel export */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { hasHrPermission } from "@/lib/hr/permissions";
import { FileText, Download, Lock, Plus, AlertTriangle, Eye } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { getStatusLabel } from "@/lib/status-labels";
import { displayDocumentType } from "@/lib/locale-display";

export const dynamic = "force-dynamic";

export default async function HrDocumentsPage() {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE" || session.role === "BRANCH_MANAGER") return null;
  const tid = session.tenantId;

  const t = await getTranslations("hrDocuments");
  const locale = await getLocale();

  const featureCheck = await canUseHrFeature(tid, "hr_documents");
  if (!featureCheck.allowed) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
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

  const canManage = await hasHrPermission("MANAGE_DOCUMENTS");
  const canExport = await hasHrPermission("EXPORT_HR_EXCEL");

  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);

  const documents = await db.employeeDocument.findMany({
    where: { companyId: tid },
    include: { employee: { select: { id: true, fullName: true, employeeCode: true, branch: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const expiringDocs = documents.filter((d) => d.status === "VALID" && d.expiryDate && new Date(d.expiryDate) <= thirtyDays);
  const expiredDocs = documents.filter((d) => d.status === "EXPIRED");
  const missingDocs = documents.filter((d) => d.status === "MISSING");

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
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("summary", { total: documents.length, expiring: expiringDocs.length, missing: missingDocs.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <Link href="/api/tenant/hr/documents/excel" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
              <Download className="h-3.5 w-3.5" /> {t("exportExcel")}
            </Link>
          )}
          {canManage && (
            <Link href="/hr/documents/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90">
              <Plus className="h-3.5 w-3.5" /> {t("addDocument")}
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{documents.filter((d) => d.status === "VALID").length}</p>
          <p className="text-xs text-muted-foreground">{t("validDocuments")}</p>
        </Card>
        <Card className={`border-border p-4 ${expiringDocs.length > 0 ? "border-amber-300 bg-amber-50/40" : ""}`}>
          <p className="text-2xl font-bold text-foreground">{expiringDocs.length}</p>
          <p className="text-xs text-muted-foreground">{t("expiringIn30")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{missingDocs.length}</p>
          <p className="text-xs text-muted-foreground">{t("missingDocuments")}</p>
        </Card>
      </div>

      <Card className="border-border">
        {documents.length === 0 ? (
          <EmptyState title={t("noDocuments")} description={t("emptyDescription")} icon={FileText} />
        ) : (
          <div className="divide-y divide-border/60">
            {documents.map((d) => {
              const isExpiring = d.status === "VALID" && d.expiryDate && new Date(d.expiryDate) <= thirtyDays;
              return (
                <Link key={d.id} href={`/hr/documents/${d.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isExpiring ? "bg-amber-100" : "bg-muted"}`}>
                      <FileText className={`h-4 w-4 ${isExpiring ? "text-amber-600" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{displayDocumentType(d.documentType, locale)}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.employee.fullName} ({d.employee.employeeCode}) · {d.documentNumber ?? "—"}
                        {d.employee.branch ? ` · ${d.employee.branch.name}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-muted-foreground">
                      {d.expiryDate && <p>{t("expiresLabel", { date: new Date(d.expiryDate).toLocaleDateString() })}</p>}
                      {isExpiring && <p className="flex items-center gap-1 text-amber-600 font-medium"><AlertTriangle className="h-3 w-3" /> {t("expiringSoon")}</p>}
                    </div>
                    <Badge variant={d.status === "VALID" ? "default" : "outline"} className={`text-xs ${statusColor(d.status)}`}>{getStatusLabel(d.status, locale)}</Badge>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
