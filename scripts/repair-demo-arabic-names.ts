/**
 * repair-demo-arabic-names.ts
 *
 * Idempotent script to update demo user/tenant display names and employee Arabic names.
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

const EMPLOYEE_ARABIC_NAMES: Record<string, { fullName: string; arabicName: string }> = {
  EMP001: { fullName: "Demo Employee", arabicName: "الموظف التجريبي" },
  EMP002: { fullName: "Sara Adel", arabicName: "سارة عادل" },
  EMP003: { fullName: "Khaled Ibrahim", arabicName: "خالد إبراهيم" },
  EMP004: { fullName: "Mona Sami", arabicName: "منى سامي" },
  EMP005: { fullName: "Youssef Ali", arabicName: "يوسف علي" },
  EMP006: { fullName: "Fatma Hassan", arabicName: "فاطمة حسن" },
  EMP007: { fullName: "Omar Khaled", arabicName: "عمر خالد" },
  EMP008: { fullName: "Nour Ahmed", arabicName: "نور أحمد" },
  EMP009: { fullName: "Mahmoud Adel", arabicName: "محمود عادل" },
  EMP010: { fullName: "Heba Samir", arabicName: "هبة سمير" },
  EMP011: { fullName: "Tarek Mokhtar", arabicName: "طارق مختار" },
  EMP012: { fullName: "Laila Mostafa", arabicName: "ليلى مصطفى" },
  EMP013: { fullName: "Hossam Tarek", arabicName: "حسام طارق" },
  EMP014: { fullName: "Reem Hassan", arabicName: "ريم حسن" },
  EMP015: { fullName: "Karim Nabil", arabicName: "كريم نبيل" },
  MGR001: { fullName: "New Cairo Manager", arabicName: "مدير فرع التجمع" },
  MGR002: { fullName: "Nasr City Manager", arabicName: "مدير فرع مدينة نصر" },
};

async function main() {
  console.log("🔧 Repairing demo Arabic display names...\n");

  // Find the demo tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: { contains: "demo" } },
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

  // Update employee records: preserve English fullName, populate arabicName
  let empUpdated = 0;
  for (const [code, data] of Object.entries(EMPLOYEE_ARABIC_NAMES)) {
    const emp = await prisma.employee.findFirst({
      where: { companyId: tenant.id, employeeCode: code },
    });

    if (!emp) {
      console.log(`⚠️  Employee ${code} not found. Skipping.`);
      continue;
    }

    const needsFullName = emp.fullName !== data.fullName;
    const needsArabicName = emp.arabicName !== data.arabicName;

    if (!needsFullName && !needsArabicName) {
      console.log(`✓  ${code} — already up to date. Skipping.`);
      continue;
    }

    const updateData: { fullName?: string; arabicName?: string } = {};
    if (needsFullName) updateData.fullName = data.fullName;
    if (needsArabicName) updateData.arabicName = data.arabicName;

    await prisma.employee.update({
      where: { id: emp.id },
      data: updateData,
    });

    const changes = [];
    if (needsFullName) changes.push(`fullName: "${emp.fullName}" → "${data.fullName}"`);
    if (needsArabicName) changes.push(`arabicName: "${emp.arabicName ?? ""}" → "${data.arabicName}"`);
    console.log(`✅ Employee ${code} — ${changes.join(", ")}`);
    empUpdated++;
  }

  console.log(`\n🎉 Done. ${updated} user(s), ${empUpdated} employee(s) updated.`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
