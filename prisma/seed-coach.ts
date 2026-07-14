/**
 * B-Coach AI module seed — Phase 9.
 *
 * Seeds:
 * - 30 system default CoachTip records across 10 themes
 * - 7 DailyCoachContent records (one per day for the past week, for the demo tenant)
 * - Sample EmployeeCoachSnapshot for EMP001
 * - Sample TeamCoachSnapshot for the demo tenant
 * - Sample AI usage logs
 * - In-app notifications for daily motivation
 *
 * Run with: bun prisma/seed-coach.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const TIPS: Array<{ title: string; body: string; theme: string; roleTarget: string; language: string }> = [
  // PUNCTUALITY (3)
  { title: "Arrive 10 minutes early", body: "Give yourself a calm buffer before your shift starts. You will feel more prepared and less rushed.", theme: "PUNCTUALITY", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  { title: "Plan your commute the night before", body: "Check the route, fuel, or transport card before you sleep. Morning-you will thank evening-you.", theme: "PUNCTUALITY", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  { title: "Communicate early if delayed", body: "If you expect to be late, message your manager the moment you know. Early communication is professionalism.", theme: "PUNCTUALITY", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  // TEAMWORK (3)
  { title: "Look for one chance to help", body: "Every shift has a moment where a teammate needs backup. Be the one who notices and steps in.", theme: "TEAMWORK", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  { title: "Call out orders clearly", body: "In a noisy kitchen or busy service area, clear calls prevent mistakes. Speak up — do not mumble.", theme: "TEAMWORK", roleTarget: "KITCHEN", language: "EN" },
  { title: "Cover a station for two minutes", body: "If a teammate is overwhelmed or needs a quick break, covering their station for two minutes can save a shift.", theme: "TEAMWORK", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  // CUSTOMER_SERVICE (3)
  { title: "Greet within 10 seconds", body: "Customers decide how they feel about your place in the first 10 seconds. A genuine greeting changes everything.", theme: "CUSTOMER_SERVICE", roleTarget: "SERVICE", language: "EN" },
  { title: "Make eye contact and smile", body: "Even behind a mask, your eyes and voice carry warmth. Customers feel it.", theme: "CUSTOMER_SERVICE", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  { title: "Thank customers as they leave", body: "A simple thank-you at the end of a visit turns first-timers into regulars.", theme: "CUSTOMER_SERVICE", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  // CLEANLINESS (3)
  { title: "Clean as you go", body: "Do not wait for the rush to end. Wiping your station between tasks keeps the shift smooth.", theme: "CLEANLINESS", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  { title: "Wipe down every 30 minutes", body: "During service, set a mental 30-minute timer to wipe your station. It prevents the end-of-shift mess.", theme: "CLEANLINESS", roleTarget: "KITCHEN", language: "EN" },
  { title: "Restock before you run out", body: "Notice when supplies are low and restock before they are empty. It saves everyone stress.", theme: "CLEANLINESS", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  // FOOD_SAFETY (3)
  { title: "Wash hands between tasks", body: "Especially between raw and ready-to-eat foods. It is the simplest, most powerful food safety habit.", theme: "FOOD_SAFETY", roleTarget: "KITCHEN", language: "EN" },
  { title: "Check temperatures before service", body: "Cold items cold, hot items hot. A 10-second thermometer check protects your customers and your team.", theme: "FOOD_SAFETY", roleTarget: "KITCHEN", language: "EN" },
  { title: "Label and date all prep", body: "Unlabeled prep is a guessing game. Label everything with item, date, and your initials.", theme: "FOOD_SAFETY", roleTarget: "KITCHEN", language: "EN" },
  // COMMUNICATION (3)
  { title: "Say it early, say it clearly", body: "Most shift problems start with silent assumptions. If you are unsure or delayed, speak up early.", theme: "COMMUNICATION", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  { title: "Ask if unsure about an order", body: "A 5-second question is cheaper than a wrong order. Ask, confirm, then execute.", theme: "COMMUNICATION", roleTarget: "SERVICE", language: "EN" },
  { title: "Use the team chat for shift issues", body: "Keep shift coordination in the team chat — not personal messages. It keeps everyone aligned.", theme: "COMMUNICATION", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  // PRESSURE_HANDLING (3)
  { title: "Slow your breath in the rush", body: "When the rush hits, your breath is your anchor. Slow exhale, then look at the next task.", theme: "PRESSURE_HANDLING", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  { title: "One order at a time", body: "Rush hour feels overwhelming because it looks like everything at once. Pick one order, execute, repeat.", theme: "PRESSURE_HANDLING", roleTarget: "KITCHEN", language: "EN" },
  { title: "Calm spreads — so does panic", body: "Your energy affects the team. Stay calm and clear, and the team will follow.", theme: "PRESSURE_HANDLING", roleTarget: "MANAGERS", language: "EN" },
  // PERSONAL_DISCIPLINE (3)
  { title: "Discipline is self-respect", body: "Showing up on time, finishing what you start, keeping your word — these habits build a reputation that opens doors.", theme: "PERSONAL_DISCIPLINE", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  { title: "Phone away during service", body: "Personal phone in your locker during service. Full focus on the team and the customer.", theme: "PERSONAL_DISCIPLINE", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  { title: "Finish what you start", body: "If you start a task, finish it. Half-done tasks create confusion and rework.", theme: "PERSONAL_DISCIPLINE", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  // SHIFT_READINESS (3)
  { title: "Arrive 5 minutes early to settle in", body: "Clocking in is not the same as starting work. Give yourself 5 minutes to settle, check your station, and start calm.", theme: "SHIFT_READINESS", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  { title: "Check your station before clocking in", body: "Walk your station, note what needs restocking, what needs cleaning. Start with a clear picture.", theme: "SHIFT_READINESS", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  { title: "Uniform on, mind focused", body: "When you put on your uniform, you shift into work mode. Take that transition seriously.", theme: "SHIFT_READINESS", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  // LEARNING (3)
  { title: "Ask one question per shift", body: "Curiosity builds skill. Ask one question per shift — about a recipe, a technique, a customer preference.", theme: "LEARNING", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  { title: "Learn from mistakes, do not hide them", body: "Everyone makes mistakes. The pros own them, learn, and move on. Hiding mistakes hurts the team.", theme: "LEARNING", roleTarget: "ALL_EMPLOYEES", language: "EN" },
  { title: "Watch the best, copy their habits", body: "Identify the strongest person on your team. Watch how they work, and adopt one of their habits.", theme: "LEARNING", roleTarget: "ALL_EMPLOYEES", language: "EN" },
];

const DAILY_CONTENT_THEMES = [
  { theme: "PUNCTUALITY", title: "Start ready, not just present", body: "A strong shift starts before the first customer arrives. When you arrive a few minutes early, you give yourself space to settle in, check your station, and start with calm energy." },
  { theme: "TEAMWORK", title: "Small help, big difference", body: "During a busy shift, the small things matter. Helping a teammate restock, calling out an order clearly, or covering a station for two minutes — these small acts keep the whole team moving." },
  { theme: "CUSTOMER_SERVICE", title: "One smile, one regular", body: "Customers remember how you made them feel. A genuine greeting, eye contact, a quick thank-you — these tiny moments turn first-time visitors into regulars." },
  { theme: "CLEANLINESS", title: "Clean as you go", body: "A clean workspace is a faster workspace. Wiping your station, restocking napkins, clearing trays — these tiny habits prevent the rush-hour mess that slows everyone down." },
  { theme: "PRESSURE_HANDLING", title: "Stay calm in the rush", body: "Rush hour tests everyone. The teams that handle it best stay calm, communicate clearly, and focus on one order at a time. Calm spreads — so does panic." },
  { theme: "FOOD_SAFETY", title: "Safety first, always", body: "Food safety is not a checkbox — it is a mindset. Wash hands, check temperatures, rotate stock, label prep. These habits protect your customers and your team." },
  { theme: "CONSISTENCY", title: "Consistency beats intensity", body: "One great shift is good. Twenty steady shifts is professional. Consistency is what managers and teammates can rely on." },
];

async function main() {
  console.log("→ Seeding B-Coach AI module...");

  // 1. System default tips (30)
  let tipCount = 0;
  for (const t of TIPS) {
    const existing = await db.coachTip.findFirst({ where: { title: t.title, isSystemDefault: true } });
    if (!existing) {
      await db.coachTip.create({
        data: {
          title: t.title,
          body: t.body,
          theme: t.theme as any,
          roleTarget: t.roleTarget as any,
          language: t.language as any,
          isSystemDefault: true,
          active: true,
        },
      });
      tipCount++;
    }
  }
  console.log(`  ✓ System tips: ${tipCount} created (${TIPS.length} total)`);

  // 2. DailyCoachContent for the demo tenant (past 7 days)
  const demoTenant = await db.tenant.findUnique({ where: { slug: "b-attend-demo" } });
  if (demoTenant) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let contentCount = 0;
    for (let i = 0; i < 7; i++) {
      const date = new Date(today); date.setDate(date.getDate() - i);
      const theme = DAILY_CONTENT_THEMES[i % DAILY_CONTENT_THEMES.length];
      const existing = await db.dailyCoachContent.findUnique({
        where: { companyId_date_audience_language: { companyId: demoTenant.id, date, audience: "ALL_EMPLOYEES", language: "EN" } },
      });
      if (!existing) {
        await db.dailyCoachContent.create({
          data: {
            companyId: demoTenant.id,
            date,
            title: theme.title,
            body: theme.body,
            theme: theme.theme as any,
            language: "EN",
            audience: "ALL_EMPLOYEES",
            createdByAi: true,
          },
        });
        contentCount++;
      }
    }
    console.log(`  ✓ DailyCoachContent: ${contentCount} created`);

    // 3. Sample EmployeeCoachSnapshot for EMP001
    const emp1 = await db.employee.findUnique({ where: { companyId_employeeCode: { companyId: demoTenant.id, employeeCode: "EMP001" } } });
    if (emp1) {
      const existingSnap = await db.employeeCoachSnapshot.findFirst({ where: { employeeId: emp1.id } });
      if (!existingSnap) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        await db.employeeCoachSnapshot.create({
          data: {
            companyId: demoTenant.id,
            employeeId: emp1.id,
            periodStart: monthStart,
            periodEnd: now,
            score: 85,
            level: "GOOD",
            positiveSummary: "You completed 10 scheduled days this month. Your strongest point is consistency in completing your shifts. You maintained complete clock-out records and always clocked in from the correct branch location.",
            improvementAreas: "The main development area is punctuality, with 2 late arrivals totaling 15 minutes. These are common shift challenges — small adjustments make a big difference.",
            practicalAdvice: "Try leaving 10–15 minutes earlier than your commute usually takes.",
            tomorrowAction: "Tomorrow, try to arrive 15 minutes earlier than your shift start to give yourself a calm buffer.",
            riskLevel: "MEDIUM",
            tags: JSON.stringify(["on-time", "clockout-routine", "punctuality-focus"]),
            generatedBy: "mock",
          },
        });
        console.log("  ✓ Sample EmployeeCoachSnapshot for EMP001");
      }
    }

    // 4. Sample TeamCoachSnapshot
    const existingTeam = await db.teamCoachSnapshot.findFirst({ where: { companyId: demoTenant.id } });
    if (!existingTeam) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      await db.teamCoachSnapshot.create({
        data: {
          companyId: demoTenant.id,
          branchId: null,
          periodStart: monthStart,
          periodEnd: now,
          summary: "Team of 15 reviewed for all branches between " + monthStart.toLocaleDateString() + " and " + now.toLocaleDateString() + ". 2 employees need coaching attention, 1 showing improvement, 5 with strong consistency.",
          employeesNeedingSupport: JSON.stringify([
            { name: "Sara Adel", code: "EMP002", reason: "2 late arrivals", suggestedAction: "Discuss commute timing in a 1:1 coaching chat." },
            { name: "Khaled Ibrahim", code: "EMP003", reason: "1 missing clock-out", suggestedAction: "Remind the employee about the clock-out reminder process." },
          ]),
          employeesImproving: JSON.stringify([
            { name: "Ahmed Mansour", code: "EMP001", trend: "reduced late arrivals" },
          ]),
          topConsistencyEmployees: JSON.stringify([
            { name: "Mona Sami", code: "EMP004", note: "Consistency score 95/100 — reliable attendance and punctuality." },
            { name: "Fatma Hassan", code: "EMP006", note: "Consistency score 92/100 — reliable attendance and punctuality." },
          ]),
          suggestedManagerActions: JSON.stringify([
            "Schedule short coaching conversations with 2 employees flagged for support.",
            "Recognize the 1 employee showing improvement in the next team huddle.",
            "Highlight the 2 most consistent employees as positive examples.",
          ]),
          dailyBriefingText: "Today's team focus: shift readiness. A few teammates need extra support this week — let us help each other start on time. Remember: clock in only when you are at the branch and ready to work, and communicate early if you expect any delay.",
          generatedBy: "mock",
        },
      });
      console.log("  ✓ Sample TeamCoachSnapshot");
    }

    // 5. AI usage logs (sample, mock provider)
    const existingLogs = await db.aiUsageLog.count({ where: { companyId: demoTenant.id } });
    if (existingLogs === 0) {
      const features = ["daily_motivation", "ai_coach", "manager_ai_insights", "daily_briefing"] as const;
      for (let i = 0; i < 20; i++) {
        const date = new Date(today);
        date.setHours(date.getHours() - i * 3);
        await db.aiUsageLog.create({
          data: {
            companyId: demoTenant.id,
            userId: null,
            feature: features[i % features.length] as any,
            provider: "MOCK",
            tokensIn: 0,
            tokensOut: Math.floor(Math.random() * 500) + 100,
            costEstimate: 0,
            status: "SUCCESS",
          },
        });
      }
      console.log("  ✓ 20 AI usage logs created");
    }

    // 6. Notifications for daily motivation (for owner + employee)
    const owner = await db.user.findUnique({ where: { companyId_email: { companyId: demoTenant.id, email: "owner@b-attend.app" } } });
    const employee1User = await db.user.findUnique({ where: { companyId_email: { companyId: demoTenant.id, email: "employee@b-attend.app" } } });
    for (const u of [owner, employee1User].filter(Boolean) as any[]) {
      const existingNotif = await db.notification.findFirst({ where: { companyId: demoTenant.id, userId: u.id, eventType: "daily_motivation" } });
      if (!existingNotif) {
        await db.notification.create({
          data: {
            companyId: demoTenant.id,
            userId: u.id,
            channel: "IN_APP",
            title: "Daily motivation ready",
            body: "Read today's coaching tip on your Coach AI page.",
            eventType: "daily_motivation",
          },
        });
      }
    }
    console.log("  ✓ Notifications for daily motivation");

    // 7. Weekly coach summary notification
    if (owner) {
      const existingWeekly = await db.notification.findFirst({ where: { companyId: demoTenant.id, userId: owner.id, eventType: "weekly_coach_summary" } });
      if (!existingWeekly) {
        await db.notification.create({
          data: {
            companyId: demoTenant.id,
            userId: owner.id,
            channel: "IN_APP",
            title: "Weekly coach summary ready",
            body: "Your team's AI coaching insights for this week are available on Team Coach AI.",
            eventType: "weekly_coach_summary",
          },
        });
      }
    }
    console.log("  ✓ Weekly coach summary notification");
  } else {
    console.log("  ⚠ Demo tenant not found, skipping tenant-specific seed");
  }

  console.log("\n✅ B-Coach seed complete.");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
