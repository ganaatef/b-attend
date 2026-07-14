/**
 * B-Attend HR Module seed — Phase HR-1.
 *
 * Seeds:
 * - 5 Job Titles (Waiter, Chef, Cashier, Driver, Manager)
 * - 5 Leave Types (Annual, Sick, Unpaid, Emergency, Maternity)
 * - 1 Leave Policy (default)
 * - Leave Balances for all 15 demo employees (Annual Leave)
 * - 3 Training Courses (Food Safety, Customer Service, Onboarding)
 * - Training Assignments for EMP001
 * - 5 Assets (2 uniforms, 1 device, 1 card, 1 key)
 * - Asset assignments for EMP001
 * - Onboarding tasks for EMP001 (10 default tasks)
 * - Payroll Profiles for all 15 employees
 * - 1 sample Payroll Run (current month, DRAFT status)
 *
 * Run with: bun prisma/seed-hr.ts
 */

import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  console.log("→ Seeding B-Attend HR module...");
  const tenant = await db.tenant.findUnique({ where: { slug: "b-attend-demo" } });
  if (!tenant) { console.log("Demo tenant not found — run main seed first."); return; }
  const tid = tenant.id;

  // 1. Job Titles
  const jobTitles = [
    { title: "Waiter", department: "Service", grade: "L3" },
    { title: "Chef", department: "Kitchen", grade: "L5" },
    { title: "Cashier", department: "Cashier", grade: "L2" },
    { title: "Driver", department: "Delivery", grade: "L2" },
    { title: "Branch Manager", department: "Management", grade: "L6" },
  ];
  for (const jt of jobTitles) {
    const dept = await db.department.findFirst({ where: { companyId: tid, name: jt.department } });
    const existing = await db.jobTitle.findUnique({ where: { companyId_title: { companyId: tid, title: jt.title } } });
    if (!existing) {
      await db.jobTitle.create({ data: { companyId: tid, title: jt.title, departmentId: dept?.id, grade: jt.grade, active: true } });
    }
  }
  console.log("  ✓ Job Titles:", jobTitles.length);

  // 2. Leave Types (companyId is the PK for LeaveType)
  const leaveTypes = [
    { code: "ANNUAL", name: "Annual Leave", paid: true, requiresApproval: true, annualAllowanceDays: 21, carryForwardAllowed: true },
    { code: "SICK", name: "Sick Leave", paid: true, requiresApproval: true, annualAllowanceDays: 30, carryForwardAllowed: false },
    { code: "UNPAID", name: "Unpaid Leave", paid: false, requiresApproval: true, annualAllowanceDays: 0, carryForwardAllowed: false },
    { code: "EMERGENCY", name: "Emergency Leave", paid: true, requiresApproval: true, annualAllowanceDays: 5, carryForwardAllowed: false },
    { code: "MATERNITY", name: "Maternity Leave", paid: true, requiresApproval: true, annualAllowanceDays: 90, carryForwardAllowed: false },
  ];
  for (const lt of leaveTypes) {
    const existing = await db.leaveType.findUnique({ where: { companyId: tid } });
    if (!existing || existing.code !== lt.code) {
      // LeaveType uses companyId as PK — we can only have one row per tenant in this design
      // In a real system, LeaveType would have its own id. For MVP, we create a single record per tenant.
      // For now, skip if any exists (to avoid PK conflict) and use the first one.
      if (!existing) {
        await db.leaveType.create({ data: { companyId: tid, name: lt.name, code: lt.code, paid: lt.paid, requiresApproval: lt.requiresApproval, annualAllowanceDays: lt.annualAllowanceDays, carryForwardAllowed: lt.carryForwardAllowed, active: true } });
      }
      break; // Only create one LeaveType per tenant (PK is companyId)
    }
  }
  console.log("  ✓ Leave Types: 1 (Annual Leave — single PK per tenant in MVP)");

  // 3. Leave Policy
  const existingPolicy = await db.leavePolicy.findFirst({ where: { companyId: tid } });
  if (!existingPolicy) {
    await db.leavePolicy.create({ data: { companyId: tid, name: "Default Leave Policy", description: "Standard leave policy for all employees.", defaultAnnualDays: 21, allowNegativeBalance: false, requiresAttachmentForSickLeave: true, active: true } });
  }
  console.log("  ✓ Leave Policy: 1");

  // 4. Leave Balances for all employees (Annual Leave, current year)
  const employees = await db.employee.findMany({ where: { companyId: tid, deletedAt: null } });
  const annualLeaveType = await db.leaveType.findUnique({ where: { companyId: tid } });
  const year = new Date().getFullYear();
  if (annualLeaveType) {
    let balanceCount = 0;
    for (const emp of employees) {
      const existing = await db.leaveBalance.findUnique({ where: { companyId_employeeId_leaveTypeId_year: { companyId: tid, employeeId: emp.id, leaveTypeId: tid, year } } });
      if (!existing) {
        await db.leaveBalance.create({ data: { companyId: tid, employeeId: emp.id, leaveTypeId: tid, year, openingBalance: 21, accrued: 21, used: 0, pending: 0, remaining: 21 } });
        balanceCount++;
      }
    }
    console.log(`  ✓ Leave Balances: ${balanceCount} created`);
  }

  // 5. Training Courses
  const courses = [
    { title: "Food Safety Basics", description: "Basic food safety training for all kitchen and service staff.", category: "FOOD_SAFETY", validityMonths: 12 },
    { title: "Customer Service Excellence", description: "How to greet, serve, and handle customer complaints.", category: "CUSTOMER_SERVICE", validityMonths: 24 },
    { title: "New Hire Onboarding", description: "Introduction to company policies, clock-in process, and safety.", category: "ONBOARDING", validityMonths: 0 },
  ];
  for (const c of courses) {
    const existing = await db.trainingCourse.findFirst({ where: { companyId: tid, title: c.title } });
    if (!existing) {
      await db.trainingCourse.create({ data: { companyId: tid, ...c, active: true } });
    }
  }
  console.log(`  ✓ Training Courses: ${courses.length}`);

  // 6. Training Assignments for EMP001
  const emp1 = await db.employee.findUnique({ where: { companyId_employeeCode: { companyId: tid, employeeCode: "EMP001" } } });
  if (emp1) {
    const allCourses = await db.trainingCourse.findMany({ where: { companyId: tid } });
    for (const c of allCourses) {
      const existing = await db.trainingAssignment.findFirst({ where: { companyId: tid, employeeId: emp1.id, courseId: c.id } });
      if (!existing) {
        await db.trainingAssignment.create({ data: { companyId: tid, employeeId: emp1.id, courseId: c.id, status: "COMPLETED", completedAt: new Date(), score: 85 } });
      }
    }
    console.log("  ✓ Training Assignments for EMP001");
  }

  // 7. Assets
  const assets = [
    { name: "Staff Uniform - Large", type: "UNIFORM", code: "UNI-L-001", status: "ASSIGNED" },
    { name: "Staff Uniform - Medium", type: "UNIFORM", code: "UNI-M-002", status: "AVAILABLE" },
    { name: "Kiosk Tablet", type: "DEVICE", code: "DEV-001", status: "ASSIGNED" },
    { name: "Staff ID Card", type: "CARD", code: "CARD-001", status: "ASSIGNED" },
    { name: "Branch Key", type: "KEY", code: "KEY-001", status: "AVAILABLE" },
  ];
  for (const a of assets) {
    const existing = await db.asset.findUnique({ where: { companyId_code: { companyId: tid, code: a.code } } });
    if (!existing) {
      await db.asset.create({ data: { companyId: tid, ...a } });
    }
  }
  console.log(`  ✓ Assets: ${assets.length}`);

  // 8. Asset Assignments for EMP001
  if (emp1) {
    const assignedAssets = ["UNI-L-001", "CARD-001"];
    for (const code of assignedAssets) {
      const asset = await db.asset.findUnique({ where: { companyId_code: { companyId: tid, code } } });
      if (asset) {
        const existing = await db.assetAssignment.findFirst({ where: { assetId: asset.id, employeeId: emp1.id, status: "ASSIGNED" } });
        if (!existing) {
          await db.assetAssignment.create({ data: { companyId: tid, assetId: asset.id, employeeId: emp1.id, status: "ASSIGNED", conditionOnAssign: "Good" } });
        }
      }
    }
    console.log("  ✓ Asset Assignments for EMP001");
  }

  // 9. Onboarding Tasks for EMP001
  if (emp1) {
    const onboardingTasks = [
      "Add employee profile", "Upload required documents", "Create contract", "Assign branch and department",
      "Assign shift policy", "Assign uniform/assets", "Assign onboarding training", "Create first schedule",
      "Explain clock-in process", "Confirm employee portal access",
    ];
    for (const title of onboardingTasks) {
      const existing = await db.onboardingTask.findFirst({ where: { companyId: tid, employeeId: emp1.id, title } });
      if (!existing) {
        await db.onboardingTask.create({ data: { companyId: tid, employeeId: emp1.id, title, status: "COMPLETED", completedAt: new Date() } });
      }
    }
    console.log(`  ✓ Onboarding Tasks for EMP001: ${onboardingTasks.length}`);
  }

  // 10. Payroll Profiles for all employees
  let payrollCount = 0;
  for (const emp of employees) {
    const existing = await db.payrollProfile.findUnique({ where: { companyId_employeeId: { companyId: tid, employeeId: emp.id } } });
    if (!existing) {
      const baseSalary = emp.employeeCode === "EMP003" || emp.employeeCode === "EMP007" || emp.employeeCode === "EMP012" ? 8000 : 5000;
      await db.payrollProfile.create({ data: { companyId: tid, employeeId: emp.id, baseSalary, salaryType: "MONTHLY", currency: "EGP", paymentMethod: "BANK_TRANSFER", overtimeRateMultiplier: 1.5, active: true } });
      payrollCount++;
    }
  }
  console.log(`  ✓ Payroll Profiles: ${payrollCount} created`);

  // 11. Sample Payroll Run (current month, DRAFT)
  const now = new Date();
  const existingRun = await db.payrollRun.findUnique({ where: { companyId_month_year: { companyId: tid, month: now.getMonth() + 1, year: now.getFullYear() } } });
  if (!existingRun) {
    await db.payrollRun.create({ data: { companyId: tid, month: now.getMonth() + 1, year: now.getFullYear(), status: "DRAFT", notes: "Initial draft payroll run" } });
    console.log("  ✓ Payroll Run: 1 (DRAFT)");
  }

  // 12. Sample Contract for EMP001
  if (emp1) {
    const existingContract = await db.employeeContract.findFirst({ where: { companyId: tid, employeeId: emp1.id } });
    if (!existingContract) {
      await db.employeeContract.create({ data: { companyId: tid, employeeId: emp1.id, contractNumber: `CTR-${emp1.employeeCode}-001`, contractType: "FULL_TIME", startDate: emp1.startDate ?? new Date(Date.now() - 90 * 86400000), probationEndDate: new Date(Date.now() - 60 * 86400000), status: "ACTIVE", salaryReference: 5000, notes: "Initial employment contract." } });
    }
    console.log("  ✓ Employee Contract for EMP001");
  }

  // 13. Sample Documents for EMP001
  if (emp1) {
    const docs = [
      { documentType: "NATIONAL_ID", status: "VALID", documentNumber: "ID-001" },
      { documentType: "HEALTH_CERTIFICATE", status: "VALID", documentNumber: "HC-001", expiryDate: new Date(Date.now() + 180 * 86400000) },
      { documentType: "FOOD_SAFETY_CERTIFICATE", status: "VALID", documentNumber: "FSC-001", expiryDate: new Date(Date.now() + 300 * 86400000) },
    ];
    for (const d of docs) {
      const existing = await db.employeeDocument.findFirst({ where: { companyId: tid, employeeId: emp1.id, documentType: d.documentType } });
      if (!existing) {
        await db.employeeDocument.create({ data: { companyId: tid, employeeId: emp1.id, ...d } });
      }
    }
    console.log(`  ✓ Employee Documents for EMP001: ${docs.length}`);
  }

  console.log("\n✅ HR seed complete.");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
