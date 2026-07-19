/**
 * /coach — Employee AI Coach Dashboard.
 *
 * Shows: daily motivation, consistency score, weekly + monthly summaries, strengths,
 * improvement areas, practical advice, tomorrow action, progress streak, recent
 * achievements, development tips.
 *
 * Privacy: employee sees only their own coaching data.
 * Feature gate: employee_coach_summary (Starter+), daily_motivation (Trial+).
 *
 * Data sources: AttendanceDay, Schedule, Punch, ApprovalRequest, Employee, Branch, Department.
 * No static fake analytics. If not enough data, shows a clean empty state.
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
import { generateEmployeeCoachSummary as generateSummaryFromLib } from "@/lib/coach/employee-summary";
import { generateDailyMotivation } from "@/lib/ai/provider";
import { canUseAiFeature } from "@/lib/ai/feature-gates";
import { getTranslations } from "next-intl/server";

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
  const t = await getTranslations("coach");
  const session = await getSession();
  if (!session?.tenantId) return null;

  // Find employee for this user
  const user = await db.user.findUnique({
    where: { id: session.sub },
    include: { employee: { include: { branch: true, department: true } } },
  });
  const employee = user?.employee;

  if (!employee) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState title={t("noEmployeeRecord")} description={t("noEmployeeDesc")} icon={Sparkles} />
      </div>
    );
  }

  // Feature gates
  const coachGate = await canUseAiFeature(session.tenantId, "employee_coach_summary");
  const motivationGate = await canUseAiFeature(session.tenantId, "daily_motivation");

  // If neither AI feature is available, show upgrade screen
  if (!coachGate.allowed && !motivationGate.allowed) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold text-foreground">{t("notAvailable")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{coachGate.reason}</p>
            <Link href="/billing" className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              {t("viewPlans")}
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

  const monthRange: DateRange = { start: monthStart, end: monthEnd };
  const weekRange: DateRange = { start: weekStart, end: weekEnd };

  // Calculate real stats and score for current period (month)
  const [weekStats, monthStats, scoreResult, streak, achievements] = await Promise.all([
    getEmployeeAttendanceStats(employee.id, weekRange),
    getEmployeeAttendanceStats(employee.id, monthRange),
    calculateConsistencyScore(employee.id, monthRange),
    calculateProgressStreak(employee.id),
    getRecentAchievements(employee.id, 5),
  ]);

  // Determine if there is enough data to show coaching
  const hasEnoughData = monthStats.scheduledDays > 0 || monthStats.presentDays > 0 || weekStats.scheduledDays > 0 || weekStats.presentDays > 0;

  // ── Daily Motivation ──
  // 1. Try DailyCoachContent for today
  // 2. Fall back to a random active CoachTip
  // 3. Fall back to mock AI generation (creates AiUsageLog)
  let motivation: { title: string; body: string; theme: string; source: string } | null = null;
  if (motivationGate.allowed) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const existingContent = await db.dailyCoachContent.findUnique({
      where: { companyId_date_audience_language: { companyId: session.tenantId, date: today, audience: "ALL_EMPLOYEES", language: "EN" } },
    });
    if (existingContent) {
      motivation = { title: existingContent.title, body: existingContent.body, theme: existingContent.theme, source: "cached" };
    } else {
      // Fall back to a CoachTip
      const tip = await db.coachTip.findFirst({
        where: { OR: [{ companyId: session.tenantId }, { isSystemDefault: true }], active: true, language: "EN" },
        orderBy: { createdAt: "desc" },
      });
      if (tip) {
        motivation = { title: tip.title, body: tip.body, theme: tip.theme, source: "tip-fallback" };
      } else {
        // Last resort: generate via mock AI provider (creates AiUsageLog)
        const generated = await generateDailyMotivation(
          { companyId: session.tenantId, userId: session.sub, feature: "daily_motivation" },
          { date: now, language: "EN", audience: "ALL_EMPLOYEES" },
        );
        motivation = { title: generated.title, body: generated.body, theme: generated.theme, source: "ai-generated" };
        // Persist the generated content for future loads
        try {
          await db.dailyCoachContent.create({
            data: {
              companyId: session.tenantId,
              date: today,
              title: generated.title,
              body: generated.body,
              theme: generated.theme as any,
              language: "EN",
              audience: "ALL_EMPLOYEES",
              createdByAi: true,
            },
          });
        } catch {}
      }
    }

    // Create notification for daily motivation (best-effort, idempotent within 24h)
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
            title: t("dailyMotivationReady"),
            body: motivation?.title ?? t("readTip"),
            eventType: "daily_motivation",
          },
        });
      }
    } catch {}
  }

  // ── Employee Coach Summary ──
  // Uses the new generateEmployeeCoachSummary from src/lib/coach/employee-summary.ts
  // which handles snapshot caching + AiUsageLog creation + improvement streak notification.
  let summary: Awaited<ReturnType<typeof generateSummaryFromLib>> | null = null;
  if (coachGate.allowed && hasEnoughData) {
    try {
      summary = await generateSummaryFromLib(
        employee.id,
        monthStart,
        monthEnd,
        { regenerate: false }, // Employee never triggers regenerate — uses cached snapshot
        { companyId: session.tenantId, userId: session.sub },
      );
    } catch (e) {
      console.error("[coach] summary generation failed:", e);
    }
  }

  // Fetch a few coaching tips for the Development Tip card
  const tips = await db.coachTip.findMany({
    where: { OR: [{ companyId: session.tenantId }, { isSystemDefault: true }], active: true, language: "EN" },
    orderBy: [{ isSystemDefault: "asc" }, { createdAt: "desc" }],
    take: 6,
  });

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
          <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
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
            <p className="mt-3 text-xs text-muted-foreground">{t("todayTheme", { theme: motivation.theme.replace(/_/g, " ").toLowerCase() })}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty state when not enough data */}
      {!hasEnoughData && (
        <Card>
          <CardContent className="py-8">
            <EmptyState
              title={t("coachingSummaryEmpty")}
              description={t("coachingSummaryEmptyDesc")}
              icon={Sparkles}
            />
          </CardContent>
        </Card>
      )}

      {/* Consistency score — only show when there is data */}
      {hasEnoughData && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground">{t("consistencyScore")}</CardTitle>
              <Badge className={`${levelColor[scoreResult.level]} text-xs`}>{scoreResult.level.replace(/_/g, " ")}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div>
                <p className={`text-5xl font-bold ${scoreColor[scoreResult.level]}`}>{scoreResult.score}</p>
                <p className="text-xs text-muted-foreground">{t("outOf100")}</p>
              </div>
              <div className="flex-1 text-sm text-muted-foreground">
                <p className="leading-relaxed">{scoreResult.explanation}</p>
              </div>
            </div>
            {scoreResult.positiveSignals.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-brand-success uppercase tracking-wider">{t("positiveSignals")}</p>
                <ul className="mt-1 space-y-0.5">
                  {scoreResult.positiveSignals.map((s, i) => <li key={i} className="text-xs text-foreground/90">✓ {s}</li>)}
                </ul>
              </div>
            )}
            {scoreResult.improvementSignals.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">{t("developmentAreas")}</p>
                <ul className="mt-1 space-y-0.5">
                  {scoreResult.improvementSignals.map((s, i) => <li key={i} className="text-xs text-foreground/90">→ {s}</li>)}
                </ul>
              </div>
            )}
            <p className="mt-4 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {t("scoreDisclaimer")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Weekly + Monthly summaries — only show when there is data */}
      {hasEnoughData && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("thisWeek")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat label={t("scheduled")} value={weekStats.scheduledDays} />
                <Stat label={t("present")} value={weekStats.presentDays} />
                <Stat label={t("late")} value={weekStats.lateDays} />
                <Stat label={t("absent")} value={weekStats.absentDays} />
                <Stat label={t("lateMinutes")} value={weekStats.totalLateMinutes} />
                <Stat label={t("overtimeMin")} value={weekStats.overtimeMinutes} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("thisMonth")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat label={t("scheduled")} value={monthStats.scheduledDays} />
                <Stat label={t("present")} value={monthStats.presentDays} />
                <Stat label={t("late")} value={monthStats.lateDays} />
                <Stat label={t("absent")} value={monthStats.absentDays} />
                <Stat label={t("lateMinutes")} value={monthStats.totalLateMinutes} />
                <Stat label={t("overtimeMin")} value={monthStats.overtimeMinutes} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI summary cards — only show when summary exists */}
      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-brand-success/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-brand-success" />
                  <CardTitle className="text-sm font-semibold text-foreground">{t("myStrengths")}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-foreground/90">{summary.positiveSummary}</p>
                {summary.cached && (
                  <p className="mt-2 text-xs text-muted-foreground">{t("cachedSnapshot")}</p>
                )}
              </CardContent>
            </Card>
            <Card className="border-amber-300">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-600" />
                  <CardTitle className="text-sm font-semibold text-foreground">{t("improvementAreas")}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {summary.improvementAreas.length > 0 ? (
                  <ul className="space-y-1.5">
                    {summary.improvementAreas.map((area, i) => (
                      <li key={i} className="text-sm text-foreground/90">→ {area}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("noImprovementAreas")}</p>
                )}
                <p className="mt-3 text-xs font-medium text-amber-700">{t("practicalAdvice")}</p>
                <p className="mt-1 text-sm text-foreground/90">{summary.practicalAdvice}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tomorrow action */}
          <Card className="border-brand-accent/30 bg-brand-accent/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sunrise className="h-4 w-4 text-brand-accent" />
                <CardTitle className="text-sm font-semibold text-foreground">{t("suggestedActionTomorrow")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground">{summary.tomorrowAction}</p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Streak + Achievements — only show when there is data */}
      {hasEnoughData && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-brand-accent" />
                <CardTitle className="text-sm font-semibold text-foreground">{t("myProgressStreak")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-brand-accent">{streak}</p>
              <p className="text-xs text-muted-foreground">{t("consecutiveOnTimeDays")}</p>
              <p className="mt-2 text-xs text-muted-foreground">{t("streakDescription")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-sm font-semibold text-foreground">{t("recentAchievements")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {achievements.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noAchievements")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {achievements.map((a, i) => <li key={i} className="text-xs text-foreground/90">🏆 {a}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Development tips — always show (tips exist independent of attendance data) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-brand-accent" />
              <CardTitle className="text-sm font-semibold text-foreground">{t("developmentTip")}</CardTitle>
            </div>
            <Link href="/coach-library" className="text-xs text-brand-accent hover:underline">{t("viewAll")}</Link>
          </div>
        </CardHeader>
        <CardContent>
          {tips.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noTipsAvailable")}</p>
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
        {t("aiDisclaimer")}
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
