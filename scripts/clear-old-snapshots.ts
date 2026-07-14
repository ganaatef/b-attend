import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const deleted = await db.employeeCoachSnapshot.deleteMany({});
console.log(`Deleted ${deleted.count} old EmployeeCoachSnapshots`);
await db.$disconnect();
