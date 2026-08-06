/**
 * B-Coach AI Provider Abstraction
 *
 * Design:
 * - MOCK provider: deterministic template-based generation. No API key required.
 * - OPENAI_PLACEHOLDER provider: placeholder; uses OPENAI_API_KEY if set, otherwise falls back to MOCK.
 * - All AI calls are isolated here. Pages/engines never call OpenAI directly.
 *
 * Privacy rules enforced at this layer:
 * - No medical/psychological/political/religious inferences
 * - No punishment/termination recommendations
 * - Constructive, supportive tone for employees
 * - Factual, operational tone for managers
 *
 * Every call is passed through sanitizeCoachOutput() before returning.
 * Every call logs to AiUsageLog (best-effort) with status SUCCESS / FAILED / FALLBACK_USED.
 */

import { db } from "@/lib/db";
import { sanitizeCoachOutput, safeFallbackEmployeeSummary, safeFallbackTeamSummary, safeFallbackDailyMotivation } from "./sanitize";

export type AiProviderType = "MOCK" | "OPENAI_PLACEHOLDER";

export interface AiContext {
  companyId: string;
  userId?: string;
  feature: "ai_coach" | "daily_motivation" | "employee_coach_summary" | "manager_ai_insights" | "coach_library" | "daily_briefing" | "ai_usage_logs" | "custom_coach_templates";
}

export interface DailyMotivationInput {
  theme?: string;
  audience?: string;
  language?: "EN" | "AR";
  date: Date;
}

export interface DailyMotivationOutput {
  title: string;
  body: string;
  theme: string;
  language: "EN" | "AR";
  createdByAi: boolean;
}

export interface EmployeeCoachSummaryInput {
  employeeName: string;
  employeeCode: string;
  branchName?: string;
  departmentName?: string;
  jobTitle?: string;
  periodStart: Date;
  periodEnd: Date;
  scheduledDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  totalLateMinutes: number;
  earlyLeaveCount: number;
  missingClockOutCount: number;
  outsideGeofenceCount: number;
  overtimeMinutes: number;
  approvedRequests: number;
  rejectedRequests: number;
  previousLateDays: number;
  previousAbsentDays: number;
  score: number;
  level: string;
}

export interface EmployeeCoachSummaryOutput {
  positiveSummary: string;
  improvementAreas: string[];
  practicalAdvice: string;
  tomorrowAction: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  tags: string[];
}

export interface ManagerTeamInsightsInput {
  branchName?: string;
  periodStart: Date;
  periodEnd: Date;
  totalEmployees: number;
  employees: Array<{
    name: string;
    code: string;
    score: number;
    level: string;
    riskLevel: string;
    lateDays: number;
    absentDays: number;
    missingClockOut: number;
    outsideGeofence: number;
    improving: boolean;
  }>;
}

export interface ManagerTeamInsightsOutput {
  summary: string;
  employeesNeedingSupport: Array<{ name: string; code: string; reason: string; suggestedAction: string }>;
  employeesImproving: Array<{ name: string; code: string; trend: string }>;
  topConsistencyEmployees: Array<{ name: string; code: string; note: string }>;
  suggestedManagerActions: string[];
  dailyBriefingText: string;
}

export interface DailyBriefingInput {
  branchName?: string;
  theme?: string;
  teamSize: number;
  avgScore: number;
}

export interface DailyBriefingOutput {
  theme: string;
  talkingPoints: string[];
  operationalReminder: string;
  motivation: string;
  branchNote?: string;
}

function getProvider(): AiProviderType {
  const env = process.env.AI_PROVIDER ?? "mock";
  if ((env.toLowerCase() === "openai" || env.toLowerCase() === "openai_placeholder") && process.env.OPENAI_API_KEY) return "OPENAI_PLACEHOLDER";
  return "MOCK";
}

async function logUsage(ctx: AiContext, provider: AiProviderType, status: "SUCCESS" | "FAILED" | "FALLBACK_USED", opts: { tokensIn?: number; tokensOut?: number; costEstimate?: number; errorMessage?: string } = {}) {
  try {
    await db.aiUsageLog.create({
      data: {
        companyId: ctx.companyId,
        userId: ctx.userId,
        feature: ctx.feature as any,
        provider: provider as any,
        tokensIn: opts.tokensIn ?? null,
        tokensOut: opts.tokensOut ?? null,
        costEstimate: opts.costEstimate ?? null,
        status: status as any,
        errorMessage: opts.errorMessage ?? null,
      },
    });
  } catch (e) {
    console.error("[ai] logUsage failed:", e);
  }
}

// ============================================================
// MOCK TEMPLATES
// ============================================================

const DAILY_MOTIVATION_TEMPLATES: Record<string, { title: string; body: string }> = {
  PUNCTUALITY: {
    title: "Start ready, not just present",
    body: "A strong shift starts before the first customer arrives. When you arrive a few minutes early, you give yourself space to settle in, check your station, and start with calm energy. Punctuality is respect — for your team, your customers, and your own work.",
  },
  TEAMWORK: {
    title: "Small help, big difference",
    body: "During a busy shift, the small things matter. Helping a teammate restock, calling out an order clearly, or covering a station for two minutes — these small acts keep the whole team moving. Look for one chance to help today.",
  },
  CLEANLINESS: {
    title: "Clean as you go",
    body: "A clean workspace is a faster workspace. Wiping your station, restocking napkins, clearing trays — these tiny habits prevent the rush-hour mess that slows everyone down. Clean as you go, and the shift stays smooth.",
  },
  CUSTOMER_SERVICE: {
    title: "One smile, one regular",
    body: "Customers remember how you made them feel. A genuine greeting, eye contact, a quick thank-you — these tiny moments turn first-time visitors into regulars. Today, give one customer a moment they will remember.",
  },
  RESPONSIBILITY: {
    title: "Own your shift",
    body: "When you own your shift, you do not wait to be told. You see what needs doing and you do it. Responsibility is not about pressure — it is about pride in your work. Today, take ownership of one task from start to finish.",
  },
  CONSISTENCY: {
    title: "Consistency beats intensity",
    body: "One great shift is good. Twenty steady shifts is professional. Consistency is what managers and teammates can rely on. Today, aim for steady, predictable, dependable — the kind of shift people can count on.",
  },
  PRESSURE_HANDLING: {
    title: "Stay calm in the rush",
    body: "Rush hour tests everyone. The teams that handle it best stay calm, communicate clearly, and focus on one order at a time. When pressure rises, slow your breath, look at the next task, and execute. Calm spreads — so does panic.",
  },
  COMMUNICATION: {
    title: "Say it early, say it clearly",
    body: "Most shift problems start with silent assumptions. If you are running late, say it early. If you are confused about an order, ask. If you need help, call it out. Clear communication prevents 90% of shift drama.",
  },
  FOOD_SAFETY: {
    title: "Safety first, always",
    body: "Food safety is not a checkbox — it is a mindset. Wash hands, check temperatures, rotate stock, label prep. These habits protect your customers and your team. Today, double-check one safety step you usually rush.",
  },
  SHIFT_READINESS: {
    title: "Ready to work, not just arrived",
    body: "Clocking in is not the same as starting work. Real readiness means uniform on, station checked, mind focused. Give yourself five minutes between arrival and the first task. It changes the whole shift.",
  },
  LEARNING: {
    title: "Learn from every shift",
    body: "Every shift teaches something — a faster way to plate, a better way to greet, a mistake to avoid next time. The best professionals are the ones who keep learning. Tonight, ask yourself: what did I learn today?",
  },
  PERSONAL_DISCIPLINE: {
    title: "Discipline is self-respect",
    body: "Discipline is not about being strict — it is about respecting your own time and energy. Showing up on time, finishing what you start, keeping your word. These habits build a reputation that opens doors.",
  },
  MOTIVATION: {
    title: "One shift at a time",
    body: "Big goals are built from small shifts. Today, focus on this shift — this order, this customer, this task. Do this one well, and the month takes care of itself.",
  },
  PROFESSIONAL_APPEARANCE: {
    title: "Look the part, feel the part",
    body: "A clean uniform and tidy appearance signal professionalism before you say a word. When you look ready, you feel ready — and customers notice. Take one minute at shift start to check your appearance.",
  },
  TAKING_FEEDBACK: {
    title: "Feedback is a gift",
    body: "When a manager gives feedback, they are investing in your growth. Listen fully, ask clarifying questions, and thank them. You do not have to agree with everything — but you do have to consider it. Today, receive one piece of feedback with openness.",
  },
  GENERAL: {
    title: "Today is a fresh shift",
    body: "Whatever happened yesterday is done. Today is a new shift, a new team, a new chance to do good work. Show up, be present, and let your effort speak for itself.",
  },
};

const AR_MOTIVATION_TEMPLATES: Record<string, { title: string; body: string }> = {
  PUNCTUALITY: {
    title: "ابدأ جاهزًا، مش بس حاضر",
    body: "وردية قوية بتبدأ قبل ما أول عميل يدخل. لما توصل بدري شوية بتدي نفسك فرصة تهدّي، تتأكد من محطتك، وتبدأ بطاقة هادية. الالتزام بالميعاد احترام — لفريقك، لعملائك، ولشغلك.",
  },
  TEAMWORK: {
    title: "مساعدة صغيرة، فرق كبير",
    body: "في الوردية المزدحمة، التفاصيل الصغيرة بتفرق. مساعدة زميل، نداء واضح على طلب، تغطية محطة لدقيقتين — الأفعال دي بتخلّي الفريق كله يمشي. النهاردة دور على فرصة واحدة تساعد فيها.",
  },
  GENERAL: {
    title: "النهاردة وردية جديدة",
    body: "اللي حصل امبارح خلص. النهاردة وردية جديدة، وفريق جديد، وفرصة جديدة تعمل شغل كويس. احضر، ركّز، وخلّي مجهودك هو اللي يتكلم.",
  },
};

// ============================================================
// PUBLIC API
// ============================================================

export async function generateDailyMotivation(ctx: AiContext, input: DailyMotivationInput): Promise<DailyMotivationOutput> {
  const provider = getProvider();
  const theme = (input.theme ?? pickThemeForDate(input.date)).toUpperCase();
  const language = input.language ?? "EN";

  try {
    // For now, both MOCK and OPENAI_PLACEHOLDER fall back to templates (OpenAI integration is a placeholder)
    // When OPENAI_PLACEHOLDER is properly integrated, this branch would call the API.
    const template = language === "AR"
      ? (AR_MOTIVATION_TEMPLATES[theme] ?? AR_MOTIVATION_TEMPLATES.GENERAL)
      : (DAILY_MOTIVATION_TEMPLATES[theme] ?? DAILY_MOTIVATION_TEMPLATES.GENERAL);

    const raw = {
      title: template.title,
      body: template.body,
      theme,
      language,
      createdByAi: provider === "OPENAI_PLACEHOLDER",
    };

    // Sanitize before returning
    const { output, safe } = sanitizeCoachOutput(raw);
    if (!safe) {
      await logUsage(ctx, provider, "FALLBACK_USED", { tokensIn: 0, tokensOut: template.body.length, errorMessage: "sanitize violations detected, replacements applied" });
    } else {
      await logUsage(ctx, provider, "SUCCESS", { tokensIn: 0, tokensOut: template.body.length });
    }

    return output as DailyMotivationOutput;
  } catch (e: any) {
    await logUsage(ctx, provider, "FALLBACK_USED", { errorMessage: e?.message ?? "generation failed" });
    return safeFallbackDailyMotivation();
  }
}

export async function generateEmployeeCoachSummary(ctx: AiContext, input: EmployeeCoachSummaryInput): Promise<EmployeeCoachSummaryOutput> {
  const provider = getProvider();

  // Build positive summary — focus on strengths, never shame
  const positives: string[] = [];
  if (input.presentDays > 0) {
    positives.push(`completed ${input.presentDays} scheduled day${input.presentDays === 1 ? "" : "s"}`);
  }
  if (input.lateDays === 0 && input.presentDays > 0) {
    positives.push("showed strong punctuality with no late arrivals");
  }
  if (input.missingClockOutCount === 0 && input.presentDays > 0) {
    positives.push("maintained complete clock-out records");
  }
  if (input.outsideGeofenceCount === 0 && input.presentDays > 0) {
    positives.push("always clocked in from the correct branch location");
  }
  if (input.overtimeMinutes > 0) {
    positives.push(`contributed ${Math.round(input.overtimeMinutes / 60)} hour${Math.round(input.overtimeMinutes / 60) === 1 ? "" : "s"} of extra effort`);
  }
  if (input.absentDays === 0) {
    positives.push("had perfect attendance");
  }
  // Improvement trend
  const improvingLate = input.lateDays < input.previousLateDays;
  const improvingAbsent = input.absentDays < input.previousAbsentDays;
  if (improvingLate) positives.push("improved punctuality compared to the previous period");
  if (improvingAbsent) positives.push("improved attendance compared to the previous period");

  const positiveSummary = positives.length > 0
    ? `You ${positives.join(", ")}. ${improvingLate || improvingAbsent ? "Great progress — keep building on this momentum." : "Keep up the steady work."}`
    : "No attendance data for this period yet. Once you start clocking in, your coach summary will appear here.";

  // Improvement areas — supportive, never shaming
  const improvements: string[] = [];
  if (input.lateDays > 0) {
    improvements.push(`punctuality, with ${input.lateDays} late arrival${input.lateDays === 1 ? "" : "s"} totaling ${input.totalLateMinutes} minutes`);
  }
  if (input.earlyLeaveCount > 0) {
    improvements.push(`completing full shifts, with ${input.earlyLeaveCount} early departure${input.earlyLeaveCount === 1 ? "" : "s"}`);
  }
  if (input.missingClockOutCount > 0) {
    improvements.push(`clock-out consistency, with ${input.missingClockOutCount} missing clock-out${input.missingClockOutCount === 1 ? "" : "s"}`);
  }
  if (input.outsideGeofenceCount > 0) {
    improvements.push(`clocking in from the correct branch location, with ${input.outsideGeofenceCount} outside-geofence record${input.outsideGeofenceCount === 1 ? "" : "s"}`);
  }
  if (input.absentDays > 0) {
    improvements.push(`attendance, with ${input.absentDays} absent day${input.absentDays === 1 ? "" : "s"}`);
  }

  const improvementAreas: string[] = improvements.length > 0
    ? improvements
    : ["No specific improvement areas this period — maintain your current rhythm and look for ways to help your team."];

  // Practical advice
  const adviceParts: string[] = [];
  if (input.lateDays > 0) adviceParts.push("Try leaving 10–15 minutes earlier than your commute usually takes.");
  if (input.missingClockOutCount > 0) adviceParts.push("Set a phone reminder 5 minutes before your shift ends to remember clock-out.");
  if (input.outsideGeofenceCount > 0) adviceParts.push("Make sure you are inside the branch before opening the clock page.");
  if (input.earlyLeaveCount > 0) adviceParts.push("If you must leave early, communicate with your manager in advance.");
  if (input.absentDays > 0) adviceParts.push("If you cannot make a shift, notify your manager as early as possible.");
  if (adviceParts.length === 0) adviceParts.push("Continue your current routine and look for one way to support a teammate today.");

  const practicalAdvice = adviceParts.join(" ");

  // Tomorrow action — single concrete step
  let tomorrowAction = "Tomorrow, aim to arrive 5 minutes early and start your shift fully ready.";
  if (input.lateDays > 0) tomorrowAction = `Tomorrow, try to arrive 15 minutes earlier than your shift start to give yourself a calm buffer.`;
  else if (input.missingClockOutCount > 0) tomorrowAction = "Tomorrow, set a reminder to clock out before you leave the branch.";
  else if (input.outsideGeofenceCount > 0) tomorrowAction = "Tomorrow, make sure you are inside the branch entrance before clocking in.";
  else if (input.absentDays > 0) tomorrowAction = "Tomorrow, focus on a clean, on-time arrival to restart your momentum.";
  else if (input.earlyLeaveCount > 0) tomorrowAction = "Tomorrow, plan to complete your full shift — let your manager know early if there is a problem.";

  // Risk level (coaching-only, never punitive)
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  const riskScore = input.absentDays * 3 + input.lateDays * 1 + input.missingClockOutCount * 1 + input.outsideGeofenceCount * 1;
  if (riskScore >= 8) riskLevel = "HIGH";
  else if (riskScore >= 3) riskLevel = "MEDIUM";

  // Tags
  const tags: string[] = [];
  if (input.absentDays === 0 && input.presentDays > 0) tags.push("perfect-attendance");
  if (input.lateDays === 0 && input.presentDays > 0) tags.push("on-time");
  if (input.overtimeMinutes > 0) tags.push("extra-effort");
  if (improvingLate || improvingAbsent) tags.push("improving");
  if (input.lateDays > 0) tags.push("punctuality-focus");
  if (input.missingClockOutCount > 0) tags.push("clockout-routine");
  if (input.outsideGeofenceCount > 0) tags.push("geofence-awareness");

  const raw = { positiveSummary, improvementAreas, practicalAdvice, tomorrowAction, riskLevel, tags };
  const { output, safe } = sanitizeCoachOutput(raw);
  const tokensOut = positiveSummary.length + improvementAreas.join(" ").length + practicalAdvice.length;
  if (!safe) {
    await logUsage(ctx, provider, "FALLBACK_USED", { tokensIn: 0, tokensOut, errorMessage: "sanitize violations detected, replacements applied" });
  } else {
    await logUsage(ctx, provider, "SUCCESS", { tokensIn: 0, tokensOut });
  }

  return output as EmployeeCoachSummaryOutput;
}

export async function generateManagerTeamInsights(ctx: AiContext, input: ManagerTeamInsightsInput): Promise<ManagerTeamInsightsOutput> {
  const provider = getProvider();

  const needsSupport = input.employees
    .filter((e) => e.riskLevel === "HIGH" || e.level === "NEEDS_SUPPORT")
    .map((e) => {
      const reasons: string[] = [];
      if (e.lateDays > 0) reasons.push(`${e.lateDays} late arrival${e.lateDays === 1 ? "" : "s"}`);
      if (e.absentDays > 0) reasons.push(`${e.absentDays} absent day${e.absentDays === 1 ? "" : "s"}`);
      if (e.missingClockOut > 0) reasons.push(`${e.missingClockOut} missing clock-out${e.missingClockOut === 1 ? "" : "s"}`);
      if (e.outsideGeofence > 0) reasons.push(`${e.outsideGeofence} outside-geofence record${e.outsideGeofence === 1 ? "" : "s"}`);
      let suggestedAction = "Have a short, supportive coaching conversation about shift readiness.";
      if (e.lateDays >= 3) suggestedAction = "Discuss commute timing and morning routine in a 1:1 coaching chat.";
      else if (e.missingClockOut > 0) suggestedAction = "Remind the employee about the clock-out reminder process.";
      else if (e.outsideGeofence > 0) suggestedAction = "Clarify the geofence rule and confirm the employee clocks in from inside the branch.";
      else if (e.absentDays > 0) suggestedAction = "Check in about any scheduling conflicts and reinforce early communication.";
      return { name: e.name, code: e.code, reason: reasons.join(", ") || "needs support", suggestedAction };
    });

  const improving = input.employees
    .filter((e) => e.improving)
    .map((e) => ({
      name: e.name,
      code: e.code,
      trend: e.lateDays === 0 ? "no late arrivals this period" : `reduced late arrivals`,
    }));

  const topConsistency = input.employees
    .filter((e) => e.level === "EXCELLENT" || e.score >= 90)
    .slice(0, 5)
    .map((e) => ({
      name: e.name,
      code: e.code,
      note: `Consistency score ${e.score}/100 — reliable attendance and punctuality.`,
    }));

  const summary = `Team of ${input.totalEmployees} reviewed for ${input.branchName ?? "all branches"} between ${input.periodStart.toLocaleDateString()} and ${input.periodEnd.toLocaleDateString()}. ${needsSupport.length} employee${needsSupport.length === 1 ? "" : "s"} need${needsSupport.length === 1 ? "s" : ""} coaching attention, ${improving.length} showing improvement, ${topConsistency.length} with strong consistency.`;

  const suggestedManagerActions: string[] = [];
  if (needsSupport.length > 0) suggestedManagerActions.push(`Schedule short coaching conversations with ${needsSupport.length} employee${needsSupport.length === 1 ? "" : "s"} flagged for support.`);
  if (improving.length > 0) suggestedManagerActions.push(`Recognize the ${improving.length} employee${improving.length === 1 ? "" : "s"} showing improvement in the next team huddle.`);
  if (topConsistency.length > 0) suggestedManagerActions.push(`Highlight the ${topConsistency.length} most consistent employee${topConsistency.length === 1 ? "" : "s"} as positive examples.`);
  if (input.employees.filter((e) => e.lateDays >= 3).length > 0) suggestedManagerActions.push("Hold a 10-minute team huddle on shift readiness and commute timing.");
  if (input.employees.filter((e) => e.missingClockOut > 0).length > 0) suggestedManagerActions.push("Remind the team about the clock-out reminder process.");
  if (suggestedManagerActions.length === 0) suggestedManagerActions.push("No specific actions needed this period — team is on track.");

  // Daily briefing text for the team
  const briefingTheme = needsSupport.length > 0 ? "shift readiness" : "consistency and teamwork";
  const dailyBriefingText = `Today's team focus: ${briefingTheme}. ${needsSupport.length > 0 ? "A few teammates need extra support this week — let us help each other start on time." : "The team is doing well — let us keep the momentum and look for ways to help each other."} Remember: clock in only when you are at the branch and ready to work, and communicate early if you expect any delay.`;

  const raw = {
    summary,
    employeesNeedingSupport: needsSupport,
    employeesImproving: improving,
    topConsistencyEmployees: topConsistency,
    suggestedManagerActions,
    dailyBriefingText,
  };
  const { output, safe } = sanitizeCoachOutput(raw);
  if (!safe) {
    await logUsage(ctx, provider, "FALLBACK_USED", { tokensIn: 0, tokensOut: summary.length, errorMessage: "sanitize violations detected, replacements applied" });
  } else {
    await logUsage(ctx, provider, "SUCCESS", { tokensIn: 0, tokensOut: summary.length });
  }

  return output as ManagerTeamInsightsOutput;
}

export async function generateDailyBriefing(ctx: AiContext, input: DailyBriefingInput): Promise<DailyBriefingOutput> {
  const provider = getProvider();
  const theme = (input.theme ?? pickThemeForDate(new Date())).toUpperCase();
  const template = DAILY_MOTIVATION_TEMPLATES[theme] ?? DAILY_MOTIVATION_TEMPLATES.GENERAL;

  const talkingPointsMap: Record<string, string[]> = {
    PUNCTUALITY: [
      "Start your shift ready, not just present.",
      "Communicate early if you expect a delay.",
      "Help your teammate start smoothly.",
    ],
    TEAMWORK: [
      "Look for one chance to help a teammate today.",
      "Call out orders clearly so everyone hears.",
      "Cover a station for two minutes if a teammate is behind.",
    ],
    CLEANLINESS: [
      "Clean as you go — do not wait for the rush.",
      "Wipe your station between tasks.",
      "Restock supplies before you run out.",
    ],
    CUSTOMER_SERVICE: [
      "Greet every customer within 10 seconds.",
      "Make eye contact and smile.",
      "Thank customers as they leave.",
    ],
    SHIFT_READINESS: [
      "Arrive 5 minutes early to settle in.",
      "Check your station before clocking in.",
      "Start your first task with full focus.",
    ],
    CONSISTENCY: [
      "Aim for steady, predictable work today.",
      "Do the basics well, every time.",
      "Be the teammate others can rely on.",
    ],
    PRESSURE_HANDLING: [
      "Stay calm — slow your breath in the rush.",
      "Focus on one order at a time.",
      "Communicate clearly, even when busy.",
    ],
    COMMUNICATION: [
      "Say it early, say it clearly.",
      "Ask if you are unsure about an order.",
      "Call out delays before they become problems.",
    ],
    FOOD_SAFETY: [
      "Wash hands between tasks.",
      "Check temperatures before service.",
      "Label and date all prep containers.",
    ],
    GENERAL: [
      "Focus on one shift at a time.",
      "Support your teammate today.",
      "Leave the station better than you found it.",
    ],
  };

  const operationalReminders: Record<string, string> = {
    PUNCTUALITY: "Clock in only when you are at the branch and ready to work.",
    TEAMWORK: "If a teammate is overwhelmed, step in for two minutes — it makes a difference.",
    CLEANLINESS: "Wipe down your station every 30 minutes during service.",
    CUSTOMER_SERVICE: "Greet customers within 10 seconds of arrival.",
    SHIFT_READINESS: "Arrive 5 minutes before your shift to settle in.",
    FOOD_SAFETY: "Wash hands between raw and ready-to-eat tasks.",
    GENERAL: "Clock in only when you are at the branch and ready to work.",
  };

  const branchNote = input.branchName ? `Today at ${input.branchName}: focus on smooth handovers between shift changes.` : undefined;

  const raw = {
    theme,
    talkingPoints: talkingPointsMap[theme] ?? talkingPointsMap.GENERAL,
    operationalReminder: operationalReminders[theme] ?? operationalReminders.GENERAL,
    motivation: template.body,
    branchNote,
  };
  const { output, safe } = sanitizeCoachOutput(raw);
  if (!safe) {
    await logUsage(ctx, provider, "FALLBACK_USED", { tokensIn: 0, tokensOut: template.body.length, errorMessage: "sanitize violations detected, replacements applied" });
  } else {
    await logUsage(ctx, provider, "SUCCESS", { tokensIn: 0, tokensOut: template.body.length });
  }

  return output as DailyBriefingOutput;
}

// ============================================================
// HELPERS
// ============================================================

function pickThemeForDate(date: Date): string {
  const themes = ["PUNCTUALITY", "TEAMWORK", "CLEANLINESS", "CUSTOMER_SERVICE", "RESPONSIBILITY", "CONSISTENCY", "PRESSURE_HANDLING", "COMMUNICATION", "FOOD_SAFETY", "SHIFT_READINESS", "LEARNING", "PERSONAL_DISCIPLINE", "MOTIVATION", "PROFESSIONAL_APPEARANCE", "TAKING_FEEDBACK", "GENERAL"];
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  return themes[dayOfYear % themes.length];
}

export function isAiEnabled(): boolean {
  const dailyCoach = (process.env.AI_DAILY_COACH_ENABLED ?? "true") !== "false";
  const employeeInsights = (process.env.AI_EMPLOYEE_INSIGHTS_ENABLED ?? "true") !== "false";
  const managerInsights = (process.env.AI_MANAGER_INSIGHTS_ENABLED ?? "true") !== "false";
  return dailyCoach && employeeInsights && managerInsights;
}

export function isDailyCoachEnabled(): boolean {
  return (process.env.AI_DAILY_COACH_ENABLED ?? "true") !== "false";
}

export function isEmployeeInsightsEnabled(): boolean {
  return (process.env.AI_EMPLOYEE_INSIGHTS_ENABLED ?? "true") !== "false";
}

export function isManagerInsightsEnabled(): boolean {
  return (process.env.AI_MANAGER_INSIGHTS_ENABLED ?? "true") !== "false";
}

export function getActiveProvider(): AiProviderType {
  return getProvider();
}

export function getProviderDisplayName(): string {
  return getProvider() === "MOCK" ? "Demo/Rules-Based Coach" : "AI Coach";
}
