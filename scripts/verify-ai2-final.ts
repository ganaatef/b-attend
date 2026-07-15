import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const tenant = await db.tenant.findUnique({ where: { slug: "b-attend-demo" } });

// Check AI usage logs for employee_coach_summary + daily_motivation
const coachSummaryLogs = await db.aiUsageLog.count({ where: { companyId: tenant!.id, feature: "employee_coach_summary" } });
const dailyMotivationLogs = await db.aiUsageLog.count({ where: { companyId: tenant!.id, feature: "daily_motivation" } });
console.log("AI Usage Logs:");
console.log("  employee_coach_summary:", coachSummaryLogs);
console.log("  daily_motivation:", dailyMotivationLogs);

// Check snapshots
const snapshots = await db.employeeCoachSnapshot.count({ where: { companyId: tenant!.id } });
console.log("EmployeeCoachSnapshots:", snapshots);

// Check improvement streak notifications
const streakNotifs = await db.notification.count({ where: { companyId: tenant!.id, eventType: "improvement_streak" } });
console.log("Improvement streak notifications:", streakNotifs);

// Check daily motivation notifications
const dailyNotifs = await db.notification.count({ where: { companyId: tenant!.id, eventType: "daily_motivation" } });
console.log("Daily motivation notifications:", dailyNotifs);

// Check AttendanceDays for EMP001
const emp = await db.employee.findUnique({ where: { companyId_employeeCode: { companyId: tenant!.id, employeeCode: "EMP001" } } });
const attendanceDays = await db.attendanceDay.findMany({ where: { employeeId: emp!.id }, select: { date: true, status: true, lateMinutes: true, workedMinutes: true }, orderBy: { date: "asc" } });
console.log("\nEMP001 AttendanceDays:");
for (const a of attendanceDays) {
  console.log(`  ${a.date.toISOString().split("T")[0]}: ${a.status}, late=${a.lateMinutes}m, worked=${a.workedMinutes}m`);
}

await db.$disconnect();
