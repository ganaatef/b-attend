/**
 * B-Attend SaaS — Phase 1 seed
 * Creates: 4 platform users, 5 plans with features, system settings, 3 demo leads.
 *
 * Run with: bun prisma/seed.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const DEMO_PASSWORD = "demo1234";

async function main() {
  console.log("→ Seeding B-Attend Phase 1 data...");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ─────────────────────────────────────────────
  // 1. Platform users (Super Admin, Sales, Support, Billing)
  // ─────────────────────────────────────────────
  const platformUsers = [
    { email: "super@b-attend.app", name: "Super Admin", role: "SUPER_ADMIN" as const },
    { email: "sales@b-attend.app", name: "Sales Admin", role: "SALES_ADMIN" as const },
    { email: "support@b-attend.app", name: "Support Agent", role: "SUPPORT_AGENT" as const },
    { email: "billing@b-attend.app", name: "Billing Admin", role: "BILLING_ADMIN" as const },
  ];

  for (const u of platformUsers) {
    await db.platformUser.upsert({
      where: { email: u.email },
      update: { passwordHash, name: u.name, role: u.role, status: "ACTIVE" },
      create: { email: u.email, name: u.name, role: u.role, status: "ACTIVE", passwordHash },
    });
    console.log(`  ✓ PlatformUser: ${u.email} (${u.role})`);
  }

  // ─────────────────────────────────────────────
  // 2. Plans
  // ─────────────────────────────────────────────
  const plans = [
    {
      slug: "trial",
      name: "Trial",
      nameAr: "تجريبي",
      description: "14-day free trial. Full feature walkthrough for one branch.",
      priceMonthly: 0,
      priceAnnual: 0,
      maxBranches: 1,
      maxEmployees: 10,
      maxManagers: 1,
      maxKiosks: 1,
      reportsLevel: "BASIC" as const,
      auditRetentionDays: 30,
      supportLevel: "SELF_SERVICE" as const,
      isTrial: true,
      isCustom: false,
      sortOrder: 1,
      features: {
        mobile_clock: true,
        kiosk: true,
        csv_export: true,
        approvals: true,
        audit_log: true,
        notifications: true,
        support_tickets: true,
        leave_requests: false,
        permission_requests: true,
        bulk_schedules: false,
        multi_branch: false,
        advanced_reports: false,
        advanced_geofence: false,
        api_access: false,
      },
    },
    {
      slug: "starter",
      name: "Starter",
      nameAr: "ستارتر",
      description: "For a single branch getting started with digital attendance.",
      priceMonthly: 999,
      priceAnnual: 9990,
      maxBranches: 1,
      maxEmployees: 25,
      maxManagers: 2,
      maxKiosks: 1,
      reportsLevel: "BASIC" as const,
      auditRetentionDays: 90,
      supportLevel: "STANDARD" as const,
      isTrial: false,
      isCustom: false,
      sortOrder: 2,
      features: {
        mobile_clock: true,
        kiosk: true,
        csv_export: true,
        approvals: true,
        audit_log: true,
        notifications: true,
        support_tickets: true,
        leave_requests: true,
        permission_requests: true,
        bulk_schedules: false,
        multi_branch: false,
        advanced_reports: false,
        advanced_geofence: false,
        api_access: false,
      },
    },
    {
      slug: "growth",
      name: "Growth",
      nameAr: "نمو",
      description: "For multi-branch operators who need bulk scheduling and leave management.",
      priceMonthly: 2499,
      priceAnnual: 24990,
      maxBranches: 3,
      maxEmployees: 75,
      maxManagers: 6,
      maxKiosks: 3,
      reportsLevel: "ADVANCED" as const,
      auditRetentionDays: 180,
      supportLevel: "PRIORITY" as const,
      isTrial: false,
      isCustom: false,
      sortOrder: 3,
      features: {
        mobile_clock: true,
        kiosk: true,
        csv_export: true,
        approvals: true,
        audit_log: true,
        notifications: true,
        support_tickets: true,
        leave_requests: true,
        permission_requests: true,
        bulk_schedules: true,
        multi_branch: true,
        advanced_reports: true,
        advanced_geofence: false,
        api_access: false,
      },
    },
    {
      slug: "pro",
      name: "Pro",
      nameAr: "برو",
      description: "For larger chains that need advanced geofence and API access.",
      priceMonthly: 4999,
      priceAnnual: 49990,
      maxBranches: 10,
      maxEmployees: 250,
      maxManagers: 20,
      maxKiosks: 10,
      reportsLevel: "ADVANCED" as const,
      auditRetentionDays: 365,
      supportLevel: "PRIORITY" as const,
      isTrial: false,
      isCustom: false,
      sortOrder: 4,
      features: {
        mobile_clock: true,
        kiosk: true,
        csv_export: true,
        approvals: true,
        audit_log: true,
        notifications: true,
        support_tickets: true,
        leave_requests: true,
        permission_requests: true,
        bulk_schedules: true,
        multi_branch: true,
        advanced_reports: true,
        advanced_geofence: true,
        api_access: true,
      },
    },
    {
      slug: "enterprise",
      name: "Enterprise",
      nameAr: "إنتربرايز",
      description: "Custom contracts, dedicated onboarding, and account management.",
      priceMonthly: 0,
      priceAnnual: 0,
      maxBranches: 100,
      maxEmployees: 5000,
      maxManagers: 500,
      maxKiosks: 200,
      reportsLevel: "ADVANCED" as const,
      auditRetentionDays: 730,
      supportLevel: "PRIORITY" as const,
      isTrial: false,
      isCustom: true,
      sortOrder: 5,
      features: {
        mobile_clock: true,
        kiosk: true,
        csv_export: true,
        approvals: true,
        audit_log: true,
        notifications: true,
        support_tickets: true,
        leave_requests: true,
        permission_requests: true,
        bulk_schedules: true,
        multi_branch: true,
        advanced_reports: true,
        advanced_geofence: true,
        api_access: true,
      },
    },
  ];

  const featureLabels: Record<string, string> = {
    mobile_clock: "Mobile clock-in/out",
    kiosk: "Branch kiosk mode",
    csv_export: "CSV export (UTF-8 BOM)",
    approvals: "Approval workflows",
    audit_log: "Audit log",
    notifications: "In-app notifications",
    support_tickets: "Support tickets",
    leave_requests: "Leave management",
    permission_requests: "Permission requests",
    bulk_schedules: "Bulk schedule generation",
    multi_branch: "Multi-branch management",
    advanced_reports: "Advanced reports",
    advanced_geofence: "Advanced geofence",
    api_access: "API access (placeholder)",
  };

  for (const p of plans) {
    const created = await db.plan.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        nameAr: p.nameAr,
        description: p.description,
        priceMonthly: p.priceMonthly,
        priceAnnual: p.priceAnnual,
        maxBranches: p.maxBranches,
        maxEmployees: p.maxEmployees,
        maxManagers: p.maxManagers,
        maxKiosks: p.maxKiosks,
        reportsLevel: p.reportsLevel,
        auditRetentionDays: p.auditRetentionDays,
        supportLevel: p.supportLevel,
        isTrial: p.isTrial,
        isCustom: p.isCustom,
        sortOrder: p.sortOrder,
        isActive: true,
      },
      create: {
        slug: p.slug,
        name: p.name,
        nameAr: p.nameAr,
        description: p.description,
        priceMonthly: p.priceMonthly,
        priceAnnual: p.priceAnnual,
        maxBranches: p.maxBranches,
        maxEmployees: p.maxEmployees,
        maxManagers: p.maxManagers,
        maxKiosks: p.maxKiosks,
        reportsLevel: p.reportsLevel,
        auditRetentionDays: p.auditRetentionDays,
        supportLevel: p.supportLevel,
        isTrial: p.isTrial,
        isCustom: p.isCustom,
        sortOrder: p.sortOrder,
        isActive: true,
      },
    });

    // Replace features
    await db.planFeature.deleteMany({ where: { planId: created.id } });
    for (const [key, enabled] of Object.entries(p.features)) {
      await db.planFeature.create({
        data: {
          planId: created.id,
          key,
          label: featureLabels[key] ?? key,
          enabled,
        },
      });
    }
    console.log(`  ✓ Plan: ${p.name} (${p.slug}) with ${Object.keys(p.features).length} features`);
  }

  // ─────────────────────────────────────────────
  // 3. System settings (singleton)
  // ─────────────────────────────────────────────
  const growthPlan = await db.plan.findUnique({ where: { slug: "growth" } });
  await db.systemSetting.upsert({
    where: { isMain: true },
    update: {
      defaultTrialDays: 14,
      defaultGracePeriodDays: 7,
      defaultCurrency: "EGP",
      manualActivationMode: true,
      supportEmail: "support@b-attend.app",
      billingEmail: "billing@b-attend.app",
      maintenanceMode: false,
      defaultPlanId: growthPlan?.id,
      paymentProviderMode: "MANUAL",
    },
    create: {
      isMain: true,
      defaultTrialDays: 14,
      defaultGracePeriodDays: 7,
      defaultCurrency: "EGP",
      manualActivationMode: true,
      supportEmail: "support@b-attend.app",
      billingEmail: "billing@b-attend.app",
      maintenanceMode: false,
      defaultPlanId: growthPlan?.id,
      paymentProviderMode: "MANUAL",
    },
  });
  console.log("  ✓ SystemSetting (singleton)");

  // ─────────────────────────────────────────────
  // 4. Demo leads
  // ─────────────────────────────────────────────
  const salesUser = await db.platformUser.findUnique({ where: { email: "sales@b-attend.app" } });
  const leads = [
    {
      name: "Ahmed Mansour",
      company: "Cairo Bite Chain",
      phone: "+20 100 123 4567",
      email: "ahmed@cairobite.example",
      businessType: "RESTAURANT" as const,
      employeesCount: 60,
      branchesCount: 4,
      message: "Interested in attendance + scheduling for 4 branches.",
      sourcePage: "REQUEST_DEMO" as const,
      status: "NEW" as const,
    },
    {
      name: "Mona Adel",
      company: "FitZone Gyms",
      phone: "+20 122 555 8899",
      email: "mona@fitzone.example",
      businessType: "GYM" as const,
      employeesCount: 30,
      branchesCount: 2,
      message: "Need clock-in for trainers and front-desk.",
      sourcePage: "CONTACT" as const,
      status: "CONTACTED" as const,
    },
    {
      name: "Khaled Sami",
      company: "NileSecurity Services",
      phone: "+20 100 777 3322",
      email: "khaled@nilesec.example",
      businessType: "SECURITY_COMPANY" as const,
      employeesCount: 200,
      branchesCount: 6,
      message: "Looking for a payroll-ready solution for 200 guards.",
      sourcePage: "PRICING" as const,
      status: "QUALIFIED" as const,
    },
  ];

  for (const l of leads) {
    const existing = await db.lead.findFirst({
      where: { email: l.email, sourcePage: l.sourcePage },
    });
    if (existing) {
      await db.lead.update({ where: { id: existing.id }, data: { ...l, assignedToId: salesUser?.id } });
    } else {
      await db.lead.create({
        data: { ...l, assignedToId: salesUser?.id, createdById: salesUser?.id },
      });
    }
    console.log(`  ✓ Lead: ${l.name} (${l.status})`);
  }

  console.log("\n✅ Seed complete.");
  console.log("   Demo accounts (password: demo1234):");
  console.log("     super@b-attend.app    — SUPER_ADMIN");
  console.log("     sales@b-attend.app    — SALES_ADMIN");
  console.log("     support@b-attend.app  — SUPPORT_AGENT");
  console.log("     billing@b-attend.app  — BILLING_ADMIN");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
