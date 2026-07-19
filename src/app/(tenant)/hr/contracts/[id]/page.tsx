/** /hr/contracts/[id] — Contract detail + full lifecycle actions */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { FileText, CheckCircle2, RefreshCw, Ban } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("hrContracts");
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE" || session.role === "BRANCH_MANAGER") return null;
  const { id } = await params;
  const tid = session.tenantId;

  const contract = await db.employeeContract.findFirst({
    where: { id, companyId: tid },
    include: {
      employee: { select: { id: true, fullName: true, employeeCode: true, branch: { select: { name: true } }, department: { select: { name: true } }, jobTitleRef: { select: { title: true } } } },
    },
  });
  if (!contract) notFound();

  const canManage = hasPerm(session.role, "MANAGE_CONTRACTS");
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const isExpiring = contract.status === "ACTIVE" && contract.endDate && new Date(contract.endDate) <= thirtyDays;

  const statusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-brand-success text-white border-transparent";
      case "EXPIRED": return "bg-destructive/10 text-destructive border-destructive/20";
      case "TERMINATED": return "bg-destructive/10 text-destructive border-destructive/20";
      case "DRAFT": return "bg-muted text-muted-foreground border-border";
      case "RENEWED": return "bg-blue-50 text-blue-600 border-blue-200";
      default: return "";
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/contracts" className="text-xs text-muted-foreground hover:text-foreground">{t("backToContracts")}</Link>
        <div className="mt-1 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">{contract.contractNumber}</h1>
            <p className="text-sm text-muted-foreground">{contract.employee.fullName} ({contract.employee.employeeCode})</p>
          </div>
          <Badge variant={contract.status === "ACTIVE" ? "default" : "outline"} className={`text-[10px] ${statusColor(contract.status)}`}>{contract.status}</Badge>
        </div>
      </div>

      {isExpiring && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs font-medium text-amber-700">{t("expiringWarning", { date: contract.endDate ? new Date(contract.endDate).toLocaleDateString() : "—" })}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("contractTypeLabelDetail")}</p>
          <p className="text-sm font-semibold text-foreground">{contract.contractType.replace(/_/g, " ")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("branchLabel")}</p>
          <p className="text-sm font-semibold text-foreground">{contract.employee.branch?.name ?? "—"}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("startDateLabelDetail")}</p>
          <p className="text-sm font-semibold text-foreground">{new Date(contract.startDate).toLocaleDateString()}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("endDateLabelDetail")}</p>
          <p className="text-sm font-semibold text-foreground">{contract.endDate ? new Date(contract.endDate).toLocaleDateString() : t("openEnded")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("probationEndLabelDetail")}</p>
          <p className="text-sm font-semibold text-foreground">{contract.probationEndDate ? new Date(contract.probationEndDate).toLocaleDateString() : "—"}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-xs text-muted-foreground">{t("salaryRefLabel")}</p>
          <p className="text-sm font-semibold text-foreground">{contract.salaryReference ? formatNumber(contract.salaryReference) : "—"}</p>
        </Card>
      </div>

      {contract.notes && (
        <Card className="border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-foreground">{t("notesCard")}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{contract.notes}</p></CardContent>
        </Card>
      )}

      {canManage && (
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("actionsCard")}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {contract.status === "DRAFT" && (
              <form action={async () => {
                "use server";
                const { updateContractAction } = await import("../../actions");
                await updateContractAction(contract.id, { status: "ACTIVE" });
              }}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-brand-success px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-success/90">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {t("activate")}
                </button>
              </form>
            )}
            {(contract.status === "ACTIVE" || contract.status === "EXPIRED") && (
              <form action={async (formData: FormData) => {
                "use server";
                const { renewContractAction } = await import("../../actions");
                const newEndDate = formData.get("newEndDate") as string;
                await renewContractAction(contract.id, newEndDate);
              }} className="flex items-end gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">{t("newEndDate")}</label>
                  <input type="date" name="newEndDate" required className="flex h-8 rounded-md border border-input bg-transparent px-2 text-xs" />
                </div>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                  <RefreshCw className="h-3.5 w-3.5" /> {t("renew")}
                </button>
              </form>
            )}
            {contract.status === "ACTIVE" && (
              <form action={async () => {
                "use server";
                const { terminateContractAction } = await import("../../actions");
                await terminateContractAction(contract.id, "Terminated from detail page");
              }}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5">
                  <Ban className="h-3.5 w-3.5" /> {t("terminate")}
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
