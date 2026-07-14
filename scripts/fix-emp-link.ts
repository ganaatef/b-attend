import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const tenant = await db.tenant.findUnique({ where: { slug: "b-attend-demo" } });
if (!tenant) { console.log("No tenant"); process.exit(1); }
const user = await db.user.findUnique({ where: { companyId_email: { companyId: tenant.id, email: "employee@b-attend.app" } } });
if (!user) { console.log("No user"); process.exit(1); }
const emp = await db.employee.findUnique({ where: { companyId_employeeCode: { companyId: tenant.id, employeeCode: "EMP001" } } });
if (!emp) { console.log("No emp"); process.exit(1); }
await db.user.update({ where: { id: user.id }, data: { employeeId: emp.id } });
console.log("Linked:", user.email, "→", emp.fullName);
await db.$disconnect();
