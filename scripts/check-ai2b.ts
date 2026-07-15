import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const tenant = await db.tenant.findUnique({ where: { slug: "b-attend-demo" } });
const emp = await db.employee.findUnique({ where: { companyId_employeeCode: { companyId: tenant!.id, employeeCode: "EMP001" } } });
const now = new Date();
const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
const schedules = await db.schedule.findMany({ where: { employeeId: emp!.id, date: { gte: monthStart } }, select: { date: true, status: true }, take: 5 });
console.log("Sample schedules:", schedules);
const adays = await db.attendanceDay.findMany({ where: { employeeId: emp!.id }, select: { date: true, status: true }, take: 5 });
console.log("Sample attendance days:", adays);
// Run recalc for this employee for the past 7 days
import { recalculateAttendanceDay } from "next/server";
console.log("Cannot import recalculateAttendanceDay from server in standalone script — but the /coach page should trigger it via generateEmployeeCoachSnapshot");
await db.$disconnect();
