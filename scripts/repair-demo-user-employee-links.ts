// ===================================================================
// Repair demo user employee links – idempotent, safe script for live demo.
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
      console.log("❌ ERROR: Demo tenant 'Demo Company' not found.")
      console.log("(Is this a fresh git clone? Run 'npx prisma seed' first.)");
      return;
    }

    const tenantId = demoTenant.id;
    console.log(`✅ Found tenant: ${demoTenant.name} (id: ${tenantId})\n`);

    // 2. Find demo users
    const employeeUser = await prisma.user.findUnique({
      where: { email: "employee@b-attend.app", companyId: tenantId },
      include: { employee: true },
    });

    const managerUser = await prisma.user.findUnique({
      where: { email: "manager@b-attend.app", companyId: tenantId },
      include: { employee: true },
    });

    console.log("📋 Users found:");
    console.log(`   - Employee user: ${employeeUser?.email} -> Employee: ${employeeUser?.employee?.employeeCode} (${employeeUser?.employee?.fullName})")
    console.log(`   - Manager user:  ${managerUser?.email} -> Employee: ${managerUser?.employee?.employeeCode} (${managerUser?.employee?.fullName})\n`);

    // Helper to create link
    async function linkUserToEmployee(user: any, employee: any) {
      if (!user || !employee) return false;
      const alreadyLinked = user.employeeId === employee.id && employee.userId === user.id;
      if (alreadyLinked) {
        console.log(`✅ ${user.email} already linked to ${employee.employeeCode} (${employee.fullName})\n`);
        return true;
      }

      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { employeeId: employee.id } }),
        prisma.employee.update({ where: { id: employee.id }, data: { userId: user.id } }),
      ]);
      console.log(`🔗 LINKED: ${user.email} → ${employee.employeeCode} (${employee.fullName})\n`);
      return true;
    }

    // 3. Find matching employee records
    // Priority: employeeCode, then fullName, then fallback to any active employee
    const employees = await prisma.employee.findMany({
      where: { companyId: tenantId, deletedAt: null },
    });

    const demoEmployee = employees.find((e) => e.employeeCode === "EMP001");
    const demoManager = employees.find((e) => e.employeeCode === "MGR001");

    console.log("📋 Matching employees found:");
    if (demoEmployee) {
      console.log(`   - Demo Employee: ${demoEmployee.employeeCode} (${demoEmployee.fullName})")
    }
    if (demoManager) {
      console.log(`   - Demo Manager: ${demoManager.employeeCode} (${demoManager.fullName})")
    }

    // Link only if both sides exist
    const linked = [];
    if (employeeUser && demoEmployee) linked.push(await linkUserToEmployee(employeeUser, demoEmployee));
    if (managerUser && demoManager) linked.push(await linkUserToEmployee(managerUser, demoManager));

    if (linked.every((l) => l)) {
      console.log("✅ All possible links repaired successfully.\n");
    } else {
      console.log("⚠️  Some links could not be repaired (users/employees missing).\n");
    }

    // 4. Verify final state
    console.log("🔍 Verification after repair:");
    const afterEmployee = await prisma.user.findUnique({
      where: { email: "employee@b-attend.app", companyId: tenantId },
      include: { employee: true },
    });
    const afterManager = await prisma.user.findUnique({
      where: { email: "manager@b-attend.app", companyId: tenantId },
      include: { employee: true },
    });

    console.log(`   Employee user -> Employee ID: ${afterEmployee?.employeeId}`);
    console.log(`   Manager user -> Employee ID: ${afterManager?.employeeId}`);

  } catch (error) {
    console.error("❌ Error during repair:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

repairDemoLinks().then(() => process.exit(0));

