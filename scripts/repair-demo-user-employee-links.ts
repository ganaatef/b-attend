// ===================================================================
// Repair demo user employee links – idempotent, safe script for live demo.
// Creates missing manager employees and establishes bidirectional links.
// ===================================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function repairDemoLinks() {
  try {
    console.log("=== Demo User ↔ Employee Linking Repair ===\n");

    // 1. Find demo tenant
    const demoTenant = await prisma.tenant.findFirst({
      where: { slug: "b-attend-demo" },
      include: { users: true, employees: true },
    });

    if (!demoTenant) {
      console.log("❌ ERROR: Demo tenant not found.");
      console.log("(Is this a fresh git clone? Run 'npx prisma seed' first.)");
      return;
    }

    const tenantId = demoTenant.id;
    console.log(`✅ Found tenant: ${demoTenant.name} (id: ${tenantId})\n`);

    // 2. Find demo users
    const employeeUser = await prisma.user.findUnique({
      where: { companyId_email: { companyId: tenantId, email: "employee@b-attend.app" } },
      include: { employee: true },
    });

    const managerUser = await prisma.user.findUnique({
      where: { companyId_email: { companyId: tenantId, email: "manager@b-attend.app" } },
      include: { employee: true },
    });

    const manager2User = await prisma.user.findUnique({
      where: { companyId_email: { companyId: tenantId, email: "manager2@b-attend.app" } },
      include: { employee: true },
    });

    console.log("📋 Users found:");
    console.log(`   - employee@b-attend.app -> Employee: ${employeeUser?.employee?.employeeCode ?? "NONE"} (${employeeUser?.employee?.fullName ?? "not linked"})`);
    console.log(`   - manager@b-attend.app  -> Employee: ${managerUser?.employee?.employeeCode ?? "NONE"} (${managerUser?.employee?.fullName ?? "not linked"})`);
    console.log(`   - manager2@b-attend.app -> Employee: ${manager2User?.employee?.employeeCode ?? "NONE"} (${manager2User?.employee?.fullName ?? "not linked"})\n`);

    // 3. Find existing employees
    const employees = await prisma.employee.findMany({
      where: { companyId: tenantId, deletedAt: null },
    });

    let demoEmployee = employees.find((e) => e.employeeCode === "EMP001");
    let ncManager = employees.find((e) => e.employeeCode === "MGR001");
    let nsManager = employees.find((e) => e.employeeCode === "MGR002");

    // Find the New Cairo branch, Management department, and Morning shift policy
    const ncBranch = await prisma.branch.findFirst({ where: { companyId: tenantId, code: "NC" } });
    const nsBranch = await prisma.branch.findFirst({ where: { companyId: tenantId, code: "NS" } });
    const mgmtDept = await prisma.department.findFirst({ where: { companyId: tenantId, name: "Management" } });
    const morningPolicy = await prisma.shiftPolicy.findFirst({ where: { companyId: tenantId, name: "Morning" } });

    // 4. Create missing manager employees
    if (!ncManager && ncBranch && mgmtDept && morningPolicy) {
      ncManager = await prisma.employee.create({
        data: {
          companyId: tenantId,
          employeeCode: "MGR001",
          fullName: "New Cairo Manager",
          phone: "+20 100 222 0001",
          email: "manager@b-attend.app",
          jobTitle: "Branch Manager",
          departmentId: mgmtDept.id,
          branchId: ncBranch.id,
          employmentType: "FULL_TIME",
          status: "ACTIVE",
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          defaultShiftPolicyId: morningPolicy.id,
          pinCode: "5000",
        },
      });
      console.log("  ✓ Created missing employee: MGR001 (New Cairo Manager)");
    }

    if (!nsManager && nsBranch && mgmtDept && morningPolicy) {
      nsManager = await prisma.employee.create({
        data: {
          companyId: tenantId,
          employeeCode: "MGR002",
          fullName: "Nasr City Manager",
          phone: "+20 100 222 0002",
          email: "manager2@b-attend.app",
          jobTitle: "Branch Manager",
          departmentId: mgmtDept.id,
          branchId: nsBranch.id,
          employmentType: "FULL_TIME",
          status: "ACTIVE",
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          defaultShiftPolicyId: morningPolicy.id,
          pinCode: "5001",
        },
      });
      console.log("  ✓ Created missing employee: MGR002 (Nasr City Manager)");
    }

    // 5. Bidirectional link helper
    async function linkBidirectional(email: string, emp: any) {
      const user = await prisma.user.findUnique({
        where: { companyId_email: { companyId: tenantId, email } },
        include: { employee: true },
      });
      if (!user || !emp) {
        console.log(`⚠️  Cannot link ${email} — user or employee missing`);
        return false;
      }
      const alreadyLinked = user.employeeId === emp.id && emp.userId === user.id;
      if (alreadyLinked) {
        console.log(`✅ ${email} already linked to ${emp.employeeCode} (${emp.fullName})`);
        return true;
      }
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { employeeId: emp.id } }),
        prisma.employee.update({ where: { id: emp.id }, data: { userId: user.id } }),
      ]);
      console.log(`🔗 LINKED: ${email} ↔ ${emp.employeeCode} (${emp.fullName})`);
      return true;
    }

    // 6. Create missing manager schedules for current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    let scheduleCount = 0;

    for (const mgr of [ncManager, nsManager].filter(Boolean)) {
      if (!mgr) continue;
      const branch = mgr.branchId === ncBranch?.id ? ncBranch : nsBranch;
      for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day === 5 || day === 6) continue;
        if (d > now) break;
        const date = new Date(d);
        const existing = await prisma.schedule.findUnique({
          where: { companyId_employeeId_date: { companyId: tenantId, employeeId: mgr.id, date } },
        });
        if (existing) continue;
        const expectedStart = new Date(date);
        expectedStart.setHours(8, 0, 0, 0);
        const expectedEnd = new Date(date);
        expectedEnd.setHours(16, 0, 0, 0);
        await prisma.schedule.create({
          data: {
            companyId: tenantId,
            employeeId: mgr.id,
            branchId: branch?.id ?? ncBranch!.id,
            date,
            shiftPolicyId: morningPolicy!.id,
            expectedStart,
            expectedEnd,
            status: "SCHEDULED",
          },
        });
        scheduleCount++;
      }
    }
    if (scheduleCount > 0) console.log(`  ✓ Created ${scheduleCount} schedules for manager employees`);

    // 7. Link all three
    console.log("\n🔗 Establishing bidirectional links:");
    const results = [];
    if (employeeUser && demoEmployee) results.push(await linkBidirectional("employee@b-attend.app", demoEmployee));
    if (managerUser && ncManager) results.push(await linkBidirectional("manager@b-attend.app", ncManager));
    if (manager2User && nsManager) results.push(await linkBidirectional("manager2@b-attend.app", nsManager));

    const failed = results.filter((r) => !r).length;
    if (failed === 0) {
      console.log("\n✅ All links repaired successfully.");
    } else {
      console.log(`\n⚠️  ${failed} link(s) could not be repaired.`);
    }

    // 8. Final verification
    console.log("\n🔍 Final state:");
    for (const email of ["employee@b-attend.app", "manager@b-attend.app", "manager2@b-attend.app"]) {
      const u = await prisma.user.findUnique({
        where: { companyId_email: { companyId: tenantId, email } },
        include: { employee: true },
      });
      console.log(`   ${email} -> employeeId: ${u?.employeeId ?? "NULL"} (${u?.employee?.employeeCode ?? "not linked"} ${u?.employee?.fullName ?? ""})`);
    }

  } catch (error) {
    console.error("❌ Error during repair:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

repairDemoLinks().then(() => process.exit(0));
