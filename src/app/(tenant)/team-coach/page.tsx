/**
 * /team-coach — Manager AI insights page.
 *
 * Owner/HR: all branches.
 * Branch Manager: only assigned branch.
 *
 * Shows team summary, employees needing support, improving, top consistency,
 * suggested actions, daily briefing preview.
 */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Brain, AlertCircle, TrendingUp, Trophy, Sunrise, ListChecks, Lock } from "lucide-react";
import { generateTeamCoachSnapshot, type DateRange } from "@/lib/ai/coach-engine";
import { canUseAiFeature } from "@/lib/ai/feature-gates";

export const dynamic = "force-dynamic";

function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }

export default async function TeamCoachPage() {
  const session = await getSession();
  if (!session?.tenantId) return null;
  if (session.role === "EMPLOYEE") {
    return <div className="p-4 text-sm text-muted-foreground">Team Coach AI is for managers, HR, and owners only.</div>;
  }

  // Feature gate
  const gate = await canUseAiFeature(session.tenantId, "manager_ai_insights");
  if (!gate.allowed) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="pt-6 text-center">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold text-foreground">Manager AI Insights is not available</h2>
            <p className="mt-1 text-sm text-muted-foreground">{gate.reason}</p>
            <Link href="/billing" className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              View plans
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Branch scoping
  let branchId: string | null = null;
  let branchName: string | undefined;
  if (session.role === "BRANCH_MANAGER") {
    const user = await db.user.findUnique({ where: { id: session.sub } });
    const managedBranches = await db.branch.findMany({ where: { companyId: session.tenantId, managerId: user?.id, deletedAt: null } });
    if (managedBranches.length === 0) {
      return <EmptyState title="No branch assigned" description="You are not assigned as a manager to any branch. Contact HR." icon={Brain} />;
    }
    branchId = managedBranches[0].id;
    branchName = managedBranches[0].name;
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const range: DateRange = { start: monthStart, end: now };

  // Generate team snapshot
  const { insights, employees } = await generateTeamCoachSnapshot(session.tenantId, branchId, range, { userId: session.sub });

  // Persist snapshot
  try {
    await db.teamCoachSnapshot.create({
      data: {
        companyId: session.tenantId,
        branchId,
        periodStart: range.start,
        periodEnd: range.end,
        summary: insights.summary,
        employeesNeedingSupport: JSON.stringify(insights.employeesNeedingSupport),
        employeesImproving: JSON.stringify(insights.employeesImproving),
        topConsistencyEmployees: JSON.stringify(insights.topConsistencyEmployees),
        suggestedManagerActions: JSON.stringify(insights.suggestedManagerActions),
        dailyBriefingText: insights.dailyBriefingText,
        generatedBy: "mock",
      },
    });
  } catch {}

  // Create notification
  try {
    const existingNotif = await db.notification.findFirst({
      where: { companyId: session.tenantId, userId: session.sub, eventType: "manager_team_insights", createdAt: { gte: new Date(now.getTime() - 86400000) } },
    });
    if (!existingNotif) {
      await db.notification.create({
        data: {
          companyId: session.tenantId,
          userId: session.sub,
          channel: "IN_APP",
          title: "Team insights ready",
          body: `${insights.employeesNeedingSupport.length} employee(s) need coaching attention.`,
          eventType: "manager_team_insights",
        },
      });
    }
  } catch {}

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-brand-accent" />
        <div>
          <h1 className="text-lg font-bold text-foreground">Team Coach AI</h1>
          <p className="text-sm text-muted-foreground">{branchName ? `Branch: ${branchName}` : "All branches"} · {employees.length} employees reviewed</p>
        </div>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Team coaching overview</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground/90">{insights.summary}</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="rounded-md border border-amber-300 bg-amber-50/40 p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{insights.employeesNeedingSupport.length}</p>
              <p className="text-xs text-muted-foreground">Need support</p>
            </div>
            <div className="rounded-md border border-brand-success/30 bg-brand-success/5 p-3 text-center">
              <p className="text-2xl font-bold text-brand-success">{insights.employeesImproving.length}</p>
              <p className="text-xs text-muted-foreground">Improving</p>
            </div>
            <div className="rounded-md border border-brand-accent/30 bg-brand-accent/5 p-3 text-center">
              <p className="text-2xl font-bold text-brand-accent">{insights.topConsistencyEmployees.length}</p>
              <p className="text-xs text-muted-foreground">Top consistency</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Needs support */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-sm font-semibold text-foreground">Employees needing attention</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {insights.employeesNeedingSupport.length === 0 ? (
            <EmptyState title="No one needs attention right now" description="Your team is on track this period." />
          ) : (
            <div className="space-y-3">
              {insights.employeesNeedingSupport.map((e, i) => (
                <div key={i} className="rounded-md border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{e.code} · {e.reason}</p>
                    </div>
                  </div>
                  <div className="mt-2 rounded-md bg-brand-accent/5 px-3 py-2 text-xs">
                    <span className="font-semibold text-brand-navy">Suggested action: </span>
                    <span className="text-foreground/90">{e.suggestedAction}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            These insights are based on attendance records. They are for coaching conversations only, not for automatic disciplinary action.
          </p>
        </CardContent>
      </Card>

      {/* Improving + Top consistency */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-brand-success" />
              <CardTitle className="text-sm font-semibold text-foreground">Employees improving</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {insights.employeesImproving.length === 0 ? (
              <p className="text-sm text-muted-foreground">No improvement trend detected this period.</p>
            ) : (
              <ul className="space-y-2">
                {insights.employeesImproving.map((e, i) => (
                  <li key={i} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{e.code}</p>
                    </div>
                    <span className="text-xs text-brand-success">{e.trend}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-semibold text-foreground">Strong consistency</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {insights.topConsistencyEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No top-consistency employees yet this period.</p>
            ) : (
              <ul className="space-y-2">
                {insights.topConsistencyEmployees.map((e, i) => (
                  <li key={i} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                    <p className="font-medium text-foreground">{e.name} <span className="text-xs text-muted-foreground">· {e.code}</span></p>
                    <p className="text-xs text-muted-foreground">{e.note}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Suggested actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-brand-accent" />
            <CardTitle className="text-sm font-semibold text-foreground">Suggested manager actions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {insights.suggestedManagerActions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-accent/10 text-xs font-semibold text-brand-accent">{i + 1}</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Daily briefing preview */}
      <Card className="border-brand-accent/30 bg-brand-accent/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sunrise className="h-4 w-4 text-brand-accent" />
              <CardTitle className="text-sm font-semibold text-foreground">Daily team briefing (preview)</CardTitle>
            </div>
            <Link href="/daily-briefing" className="text-xs text-brand-accent hover:underline">Open full briefing →</Link>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground/90">{insights.dailyBriefingText}</p>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Manager AI insights are factual and based on attendance records. They do not recommend termination, salary deduction, or automatic disciplinary action.
      </p>
    </div>
  );
}
