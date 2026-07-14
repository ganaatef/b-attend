import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const user = await db.user.findUnique({
  where: { companyId_email: { companyId: (await db.tenant.findUnique({ where: { slug: "b-attend-demo" } }))!.id, email: "employee@b-attend.app" } },
});
console.log("User:", user?.email, "employeeId:", user?.employeeId);
const emp = user?.employeeId ? await db.employee.findUnique({ where: { id: user.employeeId } }) : null;
console.log("Employee:", emp?.fullName, emp?.employeeCode);
await db.$disconnect();
