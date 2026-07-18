/**
 * repair-demo-arabic-names.ts
 *
 * Idempotent script to update demo user/tenant display names to Arabic.
 * Safe for production — only updates specific demo records, no deletes.
 *
 * Usage: npx tsx scripts/repair-demo-arabic-names.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_NAMES: Record<string, { name: string; nameAr?: string }> = {
  "owner@b-attend.app": { name: "مالك الشركة التجريبية" },
  "hr@b-attend.app": { name: "مسؤول الموارد البشرية" },
  "manager@b-attend.app": { name: "مدير فرع التجمع" },
  "manager2@b-attend.app": { name: "مدير فرع مدينة نصر" },
  "employee@b-attend.app": { name: "الموظف التجريبي" },
};

const DEMO_TENANT = {
  nameAr: "مجموعة B-Attend التجريبية",
};

async function main() {
  console.log("🔧 Repairing demo Arabic display names...\n");

  // Find the demo tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: "demo-restaurant" },
  });

  if (!tenant) {
    console.log("❌ Demo tenant not found. Skipping.");
    return;
  }

  // Update tenant Arabic name
  const tenantUpdate = await prisma.tenant.update({
    where: { id: tenant.id },
    data: DEMO_TENANT,
  });
  console.log(`✅ Tenant "${tenantUpdate.name}" → nameAr: "${tenantUpdate.nameAr}"`);

  // Update demo user names
  let updated = 0;
  for (const [email, data] of Object.entries(DEMO_NAMES)) {
    const user = await prisma.user.findFirst({
      where: { companyId: tenant.id, email },
    });

    if (!user) {
      console.log(`⚠️  User ${email} not found. Skipping.`);
      continue;
    }

    if (user.name === data.name) {
      console.log(`✓  ${email} — already "${data.name}". Skipping.`);
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { name: data.name },
    });
    console.log(`✅ ${email} — "${user.name}" → "${data.name}"`);
    updated++;
  }

  // Also update employee records for demo users
  for (const [email, data] of Object.entries(DEMO_NAMES)) {
    const emp = await prisma.employee.findFirst({
      where: { companyId: tenant.id, email },
    });

    if (!emp) continue;

    const empNameMap: Record<string, string> = {
      "owner@b-attend.app": "مالك الشركة التجريبية",
      "hr@b-attend.app": "مسؤول الموارد البشرية",
      "manager@b-attend.app": "مدير فرع التجمع",
      "manager2@b-attend.app": "مدير فرع مدينة نصر",
      "employee@b-attend.app": "الموظف التجريبي",
    };

    const newName = empNameMap[email];
    if (newName && emp.fullName !== newName) {
      await prisma.employee.update({
        where: { id: emp.id },
        data: { fullName: newName },
      });
      console.log(`✅ Employee ${emp.employeeCode} — "${emp.fullName}" → "${newName}"`);
    }
  }

  console.log(`\n🎉 Done. ${updated} user(s) updated.`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
