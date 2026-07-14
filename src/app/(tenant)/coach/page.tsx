/**
 * /coach — Employee AI Coach Dashboard.
 *
 * Shows: weekly + monthly summaries, strengths, improvement areas, daily motivation,
 * tomorrow action, progress streak, recent achievements, development tips.
 *
 * Privacy: employee sees only their own coaching data.
 * Feature gate: ai_coach (Starter+), daily_motivation (Trial+).
 */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Sparkles, TrendingUp, Target, Sunrise, Trophy, BookOpen, Lock, Heart } from "lucide-react";
import {
  calculateConsistencyScore,
  getEmployeeAttendanceStats,
  calculateProgressStreak,
  getRecentAchievements,
  type DateRange,
} from "@/lib/ai/coach-engine";
import { generateEmployeeCoachSummary, generateDailyMotivation } from "@/lib/ai/provider";
import { canUseAiFeature } from "@/lib/ai/feature-gates";

export const dynamic = "force-dynamic";

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default async function CoachPage() {
  const session = await getSession();
  if (!session?.tenantId) return null;

  // Find employee for this user
  const user = await db.user.findUnique({ where: { id: session.sub }, include: { employee: { include: { branch: true, department: true } } } });
  const employee = user?.employee;

  if (!employee) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState title="No employee record linked" description="Your user account is not linked to an employee record. Please contact your HR admin." icon={Sparkles} />
      </div>
    );
  }

  // Feature gates
  const coachGate = await canUseAiFeature(session.tenantId, "ai_coach");
  const motivationGate = await canUseAiFeature(session.tenantId, "daily_motivation");

  // If neither AI feature is available, show upgrade screen
  if (!coachGate.allowed && !motivationGate.allowed) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold text-foreground">B-Coach AI is not available on your plan</h2>
            <p className="mt-1 text-sm text-muted-foreground">{coachGate.reason}</p>
            <Link href="/billing" className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              View plans
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = now;
  const monthStart = startOfMonth(now);
  const monthEnd = now;

  // Calculate stats and score for current period (month)
  const monthRange: DateRange = { start: monthStart, end: monthEnd };
  const weekRange: DateRange = { start: weekStart, end: weekEnd };

  const [weekStats, monthStats, scoreResult, streak, achievements] = await Promise.all([
    getEmployeeAttendanceStats(employee.id, weekRange),
    getEmployeeAttendanceStats(employee.id, monthRange),
    calculateConsistencyScore(employee.id, monthRange),
    calculateProgressStreak(employee.id),
    getRecentAchievements(employee.id, 5),
  ]);

  // Generate AI summary (only if ai_coach is allowed)
  let summary: Awaited<ReturnType<typeof generateEmployeeCoachSummary>> | null = null;
  if (coachGate.allowed) {
    const periodLength = monthEnd.getTime() - monthStart.getTime();
    const prevStart = new Date(monthStart.getTime() - periodLength);
    const prevEnd = new Date(monthStart.getTime() - 86400000);
    const prevStats = await getEmployeeAttendanceStats(employee.id, { start: prevStart, end: prevEnd });

    summary = await generateEmployeeCoachSummary(
      { companyId: session.tenantId, userId: session.sub, feature: "ai_coach" },
      {
        employeeName: employee.fullName,
        employeeCode: employee.employeeCode,
        branchName: employee.branch?.name,
        departmentName: employee.department?.name,
        jobTitle: employee.jobTitle ?? undefined,
        periodStart: monthStart,
        periodEnd: monthEnd,
        ...monthStats,
        previousLateDays: prevStats.lateDays,
        previousAbsentDays: prevStats.absentDays,
        score: scoreResult.score,
        level: scoreResult.level,
      },
    );
  }

  // Generate daily motivation (only if allowed)
  let motivation: Awaited<ReturnType<typeof generateDailyMotivation>> | null = null;
  if (motivationGate.allowed) {
    motivation = await generateDailyMotivation(
      { companyId: session.tenantId, userId: session.sub, feature: "daily_motivation" },
      { date: now, language: "EN", audience: "ALL_EMPLOYEES" },
    );
  }

  // Fetch a few coaching tips
  const tips = await db.coachTip.findMany({
    where: { OR: [{ companyId: session.tenantId }, { isSystemDefault: true }], active: true, language: "EN" },
    orderBy: [{ isSystemDefault: "asc" }, { createdAt: "desc" }],
    take: 6,
  });

  // Save daily motivation to DB if generated
  if (motivation) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    try {
      await db.dailyCoachContent.upsert({
        where: { companyId_date_audience_language: { companyId: session.tenantId, date: today, audience: "ALL_EMPLOYEES", language: "EN" } },
        update: {},
        create: {
          companyId: session.tenantId,
          date: today,
          title: motivation.title,
          body: motivation.body,
          theme: motivation.theme as any,
          language: "EN",
          audience: "ALL_EMPLOYEES",
          createdByAi: true,
        },
      });
    } catch {}
  }

  // Save snapshot
  if (summary) {
    try {
      await db.employeeCoachSnapshot.create({
        data: {
          companyId: session.tenantId,
          employeeId: employee.id,
          periodStart: monthStart,
          periodEnd: monthEnd,
          score: scoreResult.score,
          level: scoreResult.level as any,
          positiveSummary: summary.positiveSummary,
          improvementAreas: summary.improvementAreas,
          practicalAdvice: summary.practicalAdvice,
          tomorrowAction: summary.tomorrowAction,
          riskLevel: summary.riskLevel as any,
          tags: JSON.stringify(summary.tags),
          generatedBy: "mock",
        },
      });
    } catch {}
  }

  // Create notification for daily motivation (best-effort, idempotent)
  if (motivationGate.allowed) {
    try {
      const existingNotif = await db.notification.findFirst({
        where: { companyId: session.tenantId, userId: session.sub, eventType: "daily_motivation", createdAt: { gte: new Date(now.getTime() - 86400000) } },
      });
      if (!existingNotif) {
        await db.notification.create({
          data: {
            companyId: session.tenantId,
            userId: session.sub,
            channel: "IN_APP",
            title: "Daily motivation ready",
            body: motivation?.title ?? "Read today's coaching tip.",
            eventType: "daily_motivation",
          },
        });
      }
    } catch {}
  }

  const levelColor: Record<string, string> = {
    EXCELLENT: "bg-brand-success text-white",
    GOOD: "bg-brand-accent text-white",
    NEEDS_ATTENTION: "bg-amber-500 text-white",
    NEEDS_SUPPORT: "bg-orange-500 text-white",
  };

  const scoreColor: Record<string, string> = {
    EXCELLENT: "text-brand-success",
    GOOD: "text-brand-accent",
    NEEDS_ATTENTION: "text-amber-600",
    NEEDS_SUPPORT: "text-orange-600",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-brand-accent" />
          <h1 className="text-lg font-bold text-foreground">My Coach AI</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Supportive coaching insights based on your attendance. No judgment — just development.</p>
      </div>

      {/* Daily motivation — most prominent */}
      {motivation && (
        <Card className="border-brand-accent/30 bg-gradient-to-br from-brand-accent/5 to-brand-navy/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sunrise className="h-4 w-4 text-brand-accent" />
              <CardTitle className="text-sm font-semibold text-foreground">{motivation.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-foreground/90">{motivation.body}</p>
            <p className="mt-3 text-xs text-muted-foreground">Today&apos;s theme: {motivation.theme.replace(/_/g, " ").toLowerCase()}</p>
          </CardContent>
        </Card>
      )}

      {/* Consistency score */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-foreground">Consistency Score (this month)</CardTitle>
            <Badge className={`${levelColor[scoreResult.level]} text-xs`}>{scoreResult.level.replace(/_/g, " ")}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div>
              <p className={`text-5xl font-bold ${scoreColor[scoreResult.level]}`}>{scoreResult.score}</p>
              <p className="text-xs text-muted-foreground">out of 100</p>
            </div>
            <div className="flex-1 text-sm text-muted-foreground">
              <p className="leading-relaxed">{scoreResult.explanation}</p>
            </div>
          </div>
          {scoreResult.positiveSignals.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-brand-success uppercase tracking-wider">Positive signals</p>
              <ul className="mt-1 space-y-0.5">
                {scoreResult.positiveSignals.map((s, i) => <li key={i} className="text-xs text-foreground/90">✓ {s}</li>)}
              </ul>
            </div>
          )}
          {scoreResult.improvementSignals.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Development areas</p>
              <ul className="mt-1 space-y-0.5">
                {scoreResult.improvementSignals.map((s, i) => <li key={i} className="text-xs text-foreground/90">→ {s}</li>)}
              </ul>
            </div>
          )}
          <p className="mt-4 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            This score is for coaching only. It does not affect your salary, evaluation, or HR decisions. Use it as a self-development tool.
          </p>
        </CardContent>
      </Card>

      {/* Weekly + Monthly summaries */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">This week</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Scheduled" value={weekStats.scheduledDays} />
              <Stat label="Present" value={weekStats.presentDays} />
              <Stat label="Late" value={weekStats.lateDays} />
              <Stat label="Absent" value={weekStats.absentDays} />
              <Stat label="Late minutes" value={weekStats.totalLateMinutes} />
              <Stat label="Overtime (min)" value={weekStats.overtimeMinutes} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">This month</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Scheduled" value={monthStats.scheduledDays} />
              <Stat label="Present" value={monthStats.presentDays} />
              <Stat label="Late" value={monthStats.lateDays} />
              <Stat label="Absent" value={monthStats.absentDays} />
              <Stat label="Late minutes" value={monthStats.totalLateMinutes} />
              <Stat label="Overtime (min)" value={monthStats.overtimeMinutes} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI summary cards */}
      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-brand-success/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-brand-success" />
                  <CardTitle className="text-sm font-semibold text-foreground">My strengths</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-foreground/90">{summary.positiveSummary}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-300">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-600" />
                  <CardTitle className="text-sm font-semibold text-foreground">Development areas</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-foreground/90">{summary.improvementAreas}</p>
                <p className="mt-3 text-xs font-medium text-amber-700">Practical advice</p>
                <p className="mt-1 text-sm text-foreground/90">{summary.practicalAdvice}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tomorrow action */}
          <Card className="border-brand-accent/30 bg-brand-accent/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sunrise className="h-4 w-4 text-brand-accent" />
                <CardTitle className="text-sm font-semibold text-foreground">Suggested action for tomorrow</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground">{summary.tomorrowAction}</p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Streak + Achievements */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-brand-accent" />
              <CardTitle className="text-sm font-semibold text-foreground">My progress streak</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-brand-accent">{streak}</p>
            <p className="text-xs text-muted-foreground">consecutive on-time days</p>
            <p className="mt-2 text-xs text-muted-foreground">A streak counts days you arrived on time with no late or absent records. Keep it growing!</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-semibold text-foreground">Recent achievements</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {achievements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No achievements yet this month. Your first on-time arrival will appear here.</p>
            ) : (
              <ul className="space-y-1.5">
                {achievements.map((a, i) => <li key={i} className="text-xs text-foreground/90">🏆 {a}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Development tips */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-brand-accent" />
              <CardTitle className="text-sm font-semibold text-foreground">Development tips</CardTitle>
            </div>
            <Link href="/coach-library" className="text-xs text-brand-accent hover:underline">View all →</Link>
          </div>
        </CardHeader>
        <CardContent>
          {tips.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tips available yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {tips.map((t) => (
                <div key={t.id} className="rounded-md border border-border bg-card/50 p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{t.theme.replace(/_/g, " ").toLowerCase()}</Badge>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-foreground">{t.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.body}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        B-Coach AI provides development support only. It is not a replacement for HR judgment or legal compliance.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
