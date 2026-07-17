/** /reports — list of report types with filters + export buttons */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Download, FileBarChart, FileText, CalendarClock, AlertTriangle, Clock, Building2, Wallet } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

const reportTypes = [
  { key: "daily", label: "Daily Attendance", description: "One row per employee per day. Includes clock-in/out times, late/early-leave minutes, status, exceptions.", icon: FileText },
  { key: "monthly", label: "Monthly Summary", description: "Per-employee totals: present/absent/leave/off days, late minutes, worked hours, overtime.", icon: CalendarClock },
  { key: "exceptions", label: "Exceptions", description: "Rows that require approval, or where status is LATE, EARLY_LEAVE, MISSING_CLOCK_OUT, OUTSIDE_GEOFENCE, ABSENT.", icon: AlertTriangle },
  { key: "overtime", label: "Overtime", description: "All rows where overtimeMinutes > 0. Shows approval status.", icon: Clock },
  { key: "branch", label: "Branch Attendance", description: "Grouped by branch: scheduled/present/absent/late days, worked hours, overtime hours.", icon: Building2 },
  { key: "payroll", label: "Payroll Export", description: "Payroll-ready per-employee summary with all the columns your payroll team needs.", icon: Wallet },
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; branchId?: string }> }) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  const t = await getTranslations("reports");
  if (session.role === "EMPLOYEE") return null;

  const params = await searchParams;
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const defaultTo = today.toISOString().split("T")[0];
  const from = params.from ?? defaultFrom;
  const to = params.to ?? defaultTo;

  let branches = await db.branch.findMany({ where: { companyId: session.tenantId, deletedAt: null }, orderBy: { name: "asc" } });
  if (session.role === "BRANCH_MANAGER") {
    const user = await db.user.findUnique({ where: { id: session.sub } });
    branches = branches.filter((b) => b.managerId === user?.id);
  }

  const queryParams = new URLSearchParams({ from, to });
  if (params.branchId) queryParams.set("branchId", params.branchId);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div><h1 className="text-lg font-bold text-foreground">{t("title")}</h1><p className="text-sm text-muted-foreground">{t("csvExportInfo")}</p></div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("filters")}</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="from">{t("from")}</Label>
              <input id="from" name="from" type="date" defaultValue={from} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
            </div>
            <div>
              <Label htmlFor="to">{t("to")}</Label>
              <input id="to" name="to" type="date" defaultValue={to} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" />
            </div>
            <div>
              <Label htmlFor="branchId">{t("branch")}</Label>
              <select id="branchId" name="branchId" defaultValue={params.branchId ?? ""} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option value="">{t("allBranches")}</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" size="sm" variant="outline">{t("applyFilters")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportTypes.map((r) => {
          const Icon = r.icon;
  const reportLabels: Record<string, { label: string; description: string }> = {
    daily: { label: t("dailyAttendance"), description: t("dailyAttendanceDesc") },
    monthly: { label: t("monthlySummary"), description: t("monthlySummaryDesc") },
    exceptions: { label: t("exceptions"), description: t("exceptionsDesc") },
    overtime: { label: t("overtimeReportLabel"), description: t("overtimeReportDesc") },
    branch: { label: t("branchAttendance"), description: t("branchAttendanceDesc") },
    payroll: { label: t("payrollExport"), description: t("payrollExportDesc") },
  };

  return (
            <Card key={r.key} className="border-border p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-accent/10 text-brand-accent"><Icon className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{reportLabels[r.key].label}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{reportLabels[r.key].description}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <a href={`/api/tenant/reports/csv?type=${r.key}&${queryParams.toString()}`} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                  <Download className="h-3.5 w-3.5" /> {t("exportCSV")}
                </a>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
