import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { CreditCard, Plus, Lock, CheckCircle, Clock, XCircle, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

const monthKeys = ["", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"] as const;

export default async function PayrollRunsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; year?: string }>;
}) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "BRANCH_MANAGER" || session.role === "EMPLOYEE") return null;
  const tid = session.tenantId;
  const t = await getTranslations("hrPayrollRuns");
  const { status: statusFilter, year: yearFilter } = await searchParams;

  const canView = hasPerm(session.role, "VIEW_PAYROLL");
  if (!canView) return null;

  const featureCheck = await canUseHrFeature(tid, "hr_payroll");
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

  const runs = await db.payrollRun.findMany({
    where: { companyId: tid },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { _count: { select: { lines: true } } },
  });

  const filtered = runs.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (yearFilter && r.year !== Number(yearFilter)) return false;
    return true;
  });

  const statusCounts = {
    total: runs.length,
    DRAFT: runs.filter((r) => r.status === "DRAFT").length,
    REVIEW: runs.filter((r) => r.status === "REVIEW").length,
    APPROVED: runs.filter((r) => r.status === "APPROVED").length,
    LOCKED: runs.filter((r) => r.status === "LOCKED").length,
    CANCELLED: runs.filter((r) => r.status === "CANCELLED").length,
  };

  const years = [...new Set(runs.map((r) => r.year))].sort((a, b) => b - a);
  const latestRun = runs[0];

  const statusConfig: Record<string, { label: string; cls: string; icon: typeof CreditCard }> = {
    DRAFT: { label: t("draft"), cls: "bg-muted text-muted-foreground border-border", icon: Clock },
    REVIEW: { label: t("review"), cls: "bg-amber-50 text-amber-600 border-amber-200", icon: Eye },
    APPROVED: { label: t("approved"), cls: "bg-blue-50 text-blue-600 border-blue-200", icon: CheckCircle },
    LOCKED: { label: t("locked"), cls: "bg-brand-success text-white border-transparent", icon: Lock },
    CANCELLED: { label: t("cancelled"), cls: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("totalRuns")} · {latestRun && `${t(monthKeys[latestRun.month])} ${latestRun.year}`}
          </p>
        </div>
        <Link
          href="/hr/payroll-runs/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90"
        >
          <Plus className="h-3.5 w-3.5" /> {t("newRun")}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{statusCounts.total}</p>
          <p className="text-xs text-muted-foreground">{t("totalRuns")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-muted-foreground">{statusCounts.DRAFT}</p>
          <p className="text-xs text-muted-foreground">{t("draft")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-amber-600">{statusCounts.REVIEW}</p>
          <p className="text-xs text-muted-foreground">{t("review")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-blue-600">{statusCounts.APPROVED}</p>
          <p className="text-xs text-muted-foreground">{t("approved")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-brand-success">{statusCounts.LOCKED}</p>
          <p className="text-xs text-muted-foreground">{t("locked")}</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-destructive">{statusCounts.CANCELLED}</p>
          <p className="text-xs text-muted-foreground">{t("cancelled")}</p>
        </Card>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">{t("filterLabel")}</span>
        <Link
          href="/hr/payroll-runs"
          className={`rounded-md px-2 py-1 ${!statusFilter ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          {t("all")}
        </Link>
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <Link
            key={key}
            href={`/hr/payroll-runs?status=${key}${yearFilter ? `&year=${yearFilter}` : ""}`}
            className={`rounded-md px-2 py-1 ${statusFilter === key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {cfg.label}
          </Link>
        ))}
        {years.length > 1 && (
          <>
            <span className="text-muted-foreground ml-2">{t("yearLabel")}</span>
            <Link
              href={`/hr/payroll-runs${statusFilter ? `?status=${statusFilter}` : ""}`}
              className={`rounded-md px-2 py-1 ${!yearFilter ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              {t("all")}
            </Link>
            {years.map((y) => (
              <Link
                key={y}
                href={`/hr/payroll-runs?${statusFilter ? `status=${statusFilter}&` : ""}year=${y}`}
                className={`rounded-md px-2 py-1 ${yearFilter === String(y) ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                {y}
              </Link>
            ))}
          </>
        )}
      </div>

      <Card className="border-border">
        <div className="divide-y divide-border/60">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <CreditCard className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-foreground">{t("noPayrollRuns")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("createFirst")}</p>
            </div>
          ) : (
            filtered.map((run) => {
              const cfg = statusConfig[run.status] ?? statusConfig.DRAFT;
              const Icon = cfg.icon;
              const lineCount = run._count.lines;
              const lineText = lineCount === 1 ? t("lineCount", { count: lineCount }) : t("lineCountPlural", { count: lineCount });
              return (
                <Link
                  key={run.id}
                  href={`/hr/payroll-runs/${run.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {t(monthKeys[run.month])} {run.year}
                        {run.id === latestRun?.id && (
                          <span className="ml-2 text-[10px] font-medium text-brand-accent">{t("latest")}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lineText}
                        {run.notes && ` · ${run.notes.slice(0, 60)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {run.approvedAt && (
                      <p className="text-xs text-muted-foreground hidden sm:block">
                        {t("approvedPrefix")} {new Date(run.approvedAt).toLocaleDateString()}
                      </p>
                    )}
                    {run.lockedAt && (
                      <p className="text-xs text-muted-foreground hidden sm:block">
                        {t("lockedPrefix")} {new Date(run.lockedAt).toLocaleDateString()}
                      </p>
                    )}
                    <Badge variant="outline" className={`text-[10px] ${cfg.cls}`}>
                      {cfg.label}
                    </Badge>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
