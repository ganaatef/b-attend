import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const tenant = await db.tenant.findUnique({ where: { slug: "b-attend-demo" } });
if (!tenant) { console.log("No tenant"); process.exit(1); }
const [jt, lt, lp, lb, tc, ta, a, aa, ot, pp, pr, ec, ed] = await Promise.all([
  db.jobTitle.count({ where: { companyId: tenant.id } }),
  db.leaveType.count({ where: { companyId: tenant.id } }),
  db.leavePolicy.count({ where: { companyId: tenant.id } }),
  db.leaveBalance.count({ where: { companyId: tenant.id } }),
  db.trainingCourse.count({ where: { companyId: tenant.id } }),
  db.trainingAssignment.count({ where: { companyId: tenant.id } }),
  db.asset.count({ where: { companyId: tenant.id } }),
  db.assetAssignment.count({ where: { companyId: tenant.id } }),
  db.onboardingTask.count({ where: { companyId: tenant.id } }),
  db.payrollProfile.count({ where: { companyId: tenant.id } }),
  db.payrollRun.count({ where: { companyId: tenant.id } }),
  db.employeeContract.count({ where: { companyId: tenant.id } }),
  db.employeeDocument.count({ where: { companyId: tenant.id } }),
]);
console.log("HR Seed Data Verification:");
console.log("  Job Titles:", jt);
console.log("  Leave Types:", lt);
console.log("  Leave Policies:", lp);
console.log("  Leave Balances:", lb);
console.log("  Training Courses:", tc);
console.log("  Training Assignments:", ta);
console.log("  Assets:", a);
console.log("  Asset Assignments:", aa);
console.log("  Onboarding Tasks:", ot);
console.log("  Payroll Profiles:", pp);
console.log("  Payroll Runs:", pr);
console.log("  Employee Contracts:", ec);
console.log("  Employee Documents:", ed);
console.log("  Total models in schema:", await db.$queryRaw`SELECT count(*) as c FROM sqlite_master WHERE type='table'`);
await db.$disconnect();
