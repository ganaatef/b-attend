import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const tenant = await db.tenant.findUnique({ where: { slug: "b-attend-demo" } });
const emp = await db.employee.findUnique({ where: { companyId_employeeCode: { companyId: tenant!.id, employeeCode: "EMP001" } } });
const now = new Date();
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
const [punches, attendanceDays, schedules, snapshots] = await Promise.all([
  db.punch.count({ where: { employeeId: emp!.id, timestamp: { gte: monthStart } } }),
  db.attendanceDay.count({ where: { employeeId: emp!.id, date: { gte: monthStart } } }),
  db.schedule.count({ where: { employeeId: emp!.id, date: { gte: monthStart } } }),
  db.employeeCoachSnapshot.count({ where: { employeeId: emp!.id } }),
]);
console.log("EMP001 this month:");
console.log("  Punches:", punches);
console.log("  AttendanceDays:", attendanceDays);
console.log("  Schedules:", schedules);
console.log("  Snapshots:", snapshots);
const aiLogs = await db.aiUsageLog.count({ where: { companyId: tenant!.id } });
console.log("AI usage logs (tenant):", aiLogs);
const features = await db.aiUsageLog.groupBy({ by: ["feature"], where: { companyId: tenant!.id }, _count: true });
console.log("By feature:", features);
await db.$disconnect();
