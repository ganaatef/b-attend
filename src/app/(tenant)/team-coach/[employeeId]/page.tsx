/**
 * /team-coach/[employeeId] — Owner/HR view of a single employee's coach snapshot.
 *
 * Shows the employee's coach summary, score, improvement areas, and a Regenerate button.
 * Branch managers can only view employees in their branch.
 * Employees cannot access this route.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { ArrowLeft, Brain, Lock } from "lucide-react";
import { generateEmployeeCoachSummary } from "@/lib/coach/employee-summary";
import { canUseAiFeature } from "@/lib/ai/feature-gates";
import { RegenerateButton } from "./RegenerateButton";

export const dynamic = "force-dynamic";

const levelColor: Record<string, string> = {
  EXCELLENT: "bg-brand-success text-white",
  GOOD: "bg-brand-accent text-white",
  NEEDS_ATTENTION: "bg-amber-500 text-white",
  NEEDS_SUPPORT: "bg-orange-500 text-white",
};

export default async function EmployeeCoachDetailPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const session = await getSession();
  if (!session?.tenantId) return null;
  if (session.role === "EMPLOYEE") {
    return <div className="p-4 text-sm text-muted-foreground">Employees cannot access this page.</div>;
  }

  const { employeeId } = await params;

  // Verify employee belongs to tenant
  const employee = await db.employee.findFirst({
    where: { id: employeeId, companyId: session.tenantId, deletedAt: null },
    include: { branch: true, department: true },
  });
  if (!employee) notFound();

  // Branch manager scope check
  if (session.role === "BRANCH_MANAGER") {
    const user = await db.user.findUnique({ where: { id: session.sub } });
    const managed = await db.branch.findMany({ where: { companyId: session.tenantId, managerId: user?.id } });
    if (!managed.some((b) => b.id === employee.branchId)) {
      return <div className="p-4 text-sm text-muted-foreground">You can only view employees in your assigned branch.</div>;
    }
  }

  // Feature gate
  const gate = await canUseAiFeature(session.tenantId, "employee_coach_summary");
  if (!gate.allowed) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="pt-6 text-center">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold text-foreground">Employee Coach Summary is not available</h2>
            <p className="mt-1 text-sm text-muted-foreground">{gate.reason}</p>
            <Link href="/billing" className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">View plans</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Current month range
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = now;

  // Generate or load cached snapshot
  let summary: Awaited<ReturnType<typeof generateEmployeeCoachSummary>> | null = null;
  try {
    summary = await generateEmployeeCoachSummary(
      employee.id,
      monthStart,
      monthEnd,
      { regenerate: false },
      { companyId: session.tenantId, userId: session.sub },
    );
  } catch (e) {
    console.error("[team-coach/employeeId] summary failed:", e);
  }

  const canRegenerate = session.role === "COMPANY_OWNER" || session.role === "HR_ADMIN";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/team-coach" className="text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="inline h-3 w-3" /> Back to Team Coach</Link>
        <div className="mt-1 flex items-center gap-2">
          <Brain className="h-5 w-5 text-brand-accent" />
          <h1 className="text-lg font-bold text-foreground">{employee.fullName}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{employee.employeeCode} · {employee.branch?.name ?? "—"} · {employee.department?.name ?? "—"}</p>
      </div>

      {canRegenerate && summary && (
        <div className="flex justify-end">
          <RegenerateButton employeeId={employee.id} periodStart={monthStart.toISOString()} periodEnd={monthEnd.toISOString()} />
        </div>
      )}

      {summary ? (
        <>
          {/* Score */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">Consistency Score</CardTitle>
                <Badge className={`${levelColor[summary.level]} text-xs`}>{summary.level.replace(/_/g, " ")}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-5xl font-bold text-foreground">{summary.score}<span className="text-lg font-normal text-muted-foreground">/100</span></p>
              {summary.cached && <p className="mt-2 text-xs text-muted-foreground">Cached snapshot from a previous generation.</p>}
              <p className="mt-2 text-xs text-muted-foreground">Risk level: {summary.riskLevel}</p>
            </CardContent>
          </Card>

          {/* Strengths */}
          <Card className="border-brand-success/30">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Positive summary</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground/90">{summary.positiveSummary}</p>
            </CardContent>
          </Card>

          {/* Improvement areas */}
          <Card className="border-amber-300">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Improvement areas</CardTitle></CardHeader>
            <CardContent>
              {summary.improvementAreas.length > 0 ? (
                <ul className="space-y-1.5">
                  {summary.improvementAreas.map((area, i) => <li key={i} className="text-sm text-foreground/90">→ {area}</li>)}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No specific improvement areas this period.</p>
              )}
              <p className="mt-3 text-xs font-medium text-amber-700">Practical advice</p>
              <p className="mt-1 text-sm text-foreground/90">{summary.practicalAdvice}</p>
              <p className="mt-3 text-xs font-medium text-brand-accent">Tomorrow action</p>
              <p className="mt-1 text-sm text-foreground/90">{summary.tomorrowAction}</p>
            </CardContent>
          </Card>

          {/* Tags */}
          {summary.tags.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Tags</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {summary.tags.map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-8">
            <EmptyState title="No coaching data yet" description="This employee's coaching summary will appear after a few attendance records are available." icon={Brain} />
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground">
        AI insights are for coaching support only and should not be used as the sole basis for disciplinary decisions.
      </p>
    </div>
  );
}
