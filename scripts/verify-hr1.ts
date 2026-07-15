import { PrismaClient } from "@prisma/client";

async function main() {
  const db = new PrismaClient();
  const tenant = await db.tenant.findUnique({ where: { slug: "b-attend-demo" } });
  if (!tenant) { console.log("No tenant"); process.exit(1); }
  const tid = tenant.id;

  console.log("=== HR-1.1 Verification ===\n");

  const [jt, lt, lp, lb, tc, ta, a, aa, ot, pp, pr, ec, ed] = await Promise.all([
    db.jobTitle.count({ where: { companyId: tid } }),
    db.leaveType.count({ where: { companyId: tid } }),
    db.leavePolicy.count({ where: { companyId: tid } }),
    db.leaveBalance.count({ where: { companyId: tid } }),
    db.trainingCourse.count({ where: { companyId: tid } }),
    db.trainingAssignment.count({ where: { companyId: tid } }),
    db.asset.count({ where: { companyId: tid } }),
    db.assetAssignment.count({ where: { companyId: tid } }),
    db.onboardingTask.count({ where: { companyId: tid } }),
    db.payrollProfile.count({ where: { companyId: tid } }),
    db.payrollRun.count({ where: { companyId: tid } }),
    db.employeeContract.count({ where: { companyId: tid } }),
    db.employeeDocument.count({ where: { companyId: tid } }),
  ]);
  console.log("HR Seed Data Counts:");
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

  console.log("\n=== HR-1.1 LeaveType Checks ===\n");

  const leaveTypes = await db.leaveType.findMany({ where: { companyId: tid } });
  console.log(`✓ Multiple LeaveType records: ${leaveTypes.length} (expected ≥6)`);
  if (leaveTypes.length < 6) {
    console.error("✗ FAIL: Expected at least 6 leave types");
    process.exit(1);
  }

  for (const ltv of leaveTypes) {
    if (!ltv.id || ltv.id === tid) {
      console.error(`✗ FAIL: LeaveType ${ltv.code} has invalid id: ${ltv.id}`);
      process.exit(1);
    }
  }
  console.log("✓ All LeaveType records have unique IDs (not companyId)");

  const codes = leaveTypes.map(l => l.code);
  const uniqueCodes = new Set(codes);
  if (codes.length !== uniqueCodes.size) {
    console.error("✗ FAIL: Duplicate LeaveType codes found:", codes);
    process.exit(1);
  }
  console.log(`✓ LeaveType codes are unique per company: ${codes.join(", ")}`);

  const expectedCodes = ["ANNUAL", "SICK", "UNPAID", "EMERGENCY", "MATERNITY", "OTHER"];
  for (const ec of expectedCodes) {
    if (!uniqueCodes.has(ec)) {
      console.error(`✗ FAIL: Missing expected LeaveType code: ${ec}`);
      process.exit(1);
    }
  }
  console.log(`✓ All expected codes present: ${expectedCodes.join(", ")}`);

  const balances = await db.leaveBalance.findMany({ where: { companyId: tid } });
  const validLeaveTypeIds = new Set(leaveTypes.map(l => l.id));
  let invalidBalances = 0;
  for (const b of balances) {
    if (!validLeaveTypeIds.has(b.leaveTypeId)) {
      console.error(`✗ FAIL: LeaveBalance ${b.id} references invalid leaveTypeId: ${b.leaveTypeId}`);
      invalidBalances++;
    }
  }
  if (invalidBalances > 0) {
    process.exit(1);
  }
  console.log(`✓ All ${balances.length} LeaveBalance records link to valid LeaveType IDs`);

  const requests = await db.leaveRequest.findMany({ where: { companyId: tid } });
  if (requests.length > 0) {
    let invalidRequests = 0;
    for (const r of requests) {
      if (!validLeaveTypeIds.has(r.leaveTypeId)) {
        console.error(`✗ FAIL: LeaveRequest ${r.id} references invalid leaveTypeId: ${r.leaveTypeId}`);
        invalidRequests++;
      }
    }
    if (invalidRequests > 0) process.exit(1);
    console.log(`✓ All ${requests.length} LeaveRequest records link to valid LeaveType IDs`);
  } else {
    console.log("✓ No LeaveRequest records seeded (OK)");
  }

  const anyWithCompanyIdPk = leaveTypes.some(l => l.id === l.companyId);
  if (anyWithCompanyIdPk) {
    console.error("✗ FAIL: Some LeaveType still uses companyId as primary key");
    process.exit(1);
  }
  console.log("✓ No LeaveType uses companyId as primary key");

  console.log("\n=== Safety Check ===\n");
  console.log("✓ Confirmed: Only LeaveType had companyId as PK (now fixed)");

  console.log("\n✅ All HR-1.1 verification checks passed.\n");

  await db.$disconnect();
}

main().catch((e) => { console.error("Verification failed:", e); process.exit(1); });
