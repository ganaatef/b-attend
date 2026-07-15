/**
 * B-Attend SaaS — Full seed (Phase 1-3)
 *
 * Creates:
 *  - 4 platform users (super/sales/support/billing @b-attend.app, password demo1234)
 *  - 5 plans (Trial/Starter/Growth/Pro/Enterprise) × 14 features each
 *  - System settings singleton
 *  - 3 demo leads
 *  - Demo tenant "B-Attend Demo Restaurant Group" with ACTIVE status + Growth plan + paid invoice
 *  - 3 branches (New Cairo, Nasr City, Maadi)
 *  - 6 departments (Kitchen, Service, Cashier, Delivery, Stewarding, Management)
 *  - 5 shift policies (Morning, Evening, Night, Kitchen Double, Part Time)
 *  - 9 tenant users (owner, hr, manager, manager2, employee × 5)
 *  - 15 employees with schedules for the current month
 *  - Sample attendance + approvals + invoices
 *
 * Run with: bun prisma/seed.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const DEMO_PASSWORD = "demo1234";

async function main() {
  // ── Safety guard ─────────────────────────────────────────────
  // Never auto-seed production. Only seed when explicitly allowed:
  //   - Not production, OR
  //   - DEMO_SEED_CONFIRM=true (intentional client-demo seeding)
  if (process.env.NODE_ENV === "production" && process.env.DEMO_SEED_CONFIRM !== "true") {
    console.warn(
      "⛔ Seed skipped: NODE_ENV=production and DEMO_SEED_CONFIRM is not 'true'.\n" +
      "   This protects production data. To seed the live demo, set DEMO_SEED_CONFIRM=true\n" +
      "   and re-run `npm run db:seed:demo`."
    );
    return;
  }
  console.log("→ Seeding B-Attend full data...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ─────────────────────────────────────────────
  // 1. Platform users
  // ─────────────────────────────────────────────
  const platformUsers = [
    { email: "super@b-attend.app", name: "Super Admin", role: "SUPER_ADMIN" as const },
    { email: "sales@b-attend.app", name: "Sales Admin", role: "SALES_ADMIN" as const },
    { email: "support@b-attend.app", name: "Support Agent", role: "SUPPORT_AGENT" as const },
    { email: "billing@b-attend.app", name: "Billing Admin", role: "BILLING_ADMIN" as const },
  ];
  const platformUserMap: Record<string, { id: string }> = {};
  for (const u of platformUsers) {
    const created = await db.platformUser.upsert({
      where: { email: u.email },
      update: { passwordHash, name: u.name, role: u.role, status: "ACTIVE" },
      create: { email: u.email, name: u.name, role: u.role, status: "ACTIVE", passwordHash },
    });
    platformUserMap[u.email] = { id: created.id };
    console.log(`  ✓ PlatformUser: ${u.email}`);
  }

  // ─────────────────────────────────────────────
  // 2. Plans + features
  // ─────────────────────────────────────────────
  const plans = [
    { slug: "trial", name: "Trial", nameAr: "تجريبي", description: "14-day free trial. One branch, up to 10 employees.",
      priceMonthly: 0, priceAnnual: 0, maxBranches: 1, maxEmployees: 10, maxManagers: 1, maxKiosks: 1,
      reportsLevel: "BASIC" as const, auditRetentionDays: 30, supportLevel: "SELF_SERVICE" as const,
      isTrial: true, isCustom: false, sortOrder: 1,
      features: { mobile_clock: true, kiosk: true, csv_export: true, approvals: true, audit_log: true, notifications: true, support_tickets: true, leave_requests: false, permission_requests: true, bulk_schedules: false, multi_branch: false, advanced_reports: false, advanced_geofence: false, api_access: false } },
    { slug: "starter", name: "Starter", nameAr: "ستارتر", description: "Single branch getting started with digital attendance.",
      priceMonthly: 999, priceAnnual: 9990, maxBranches: 1, maxEmployees: 25, maxManagers: 2, maxKiosks: 1,
      reportsLevel: "BASIC" as const, auditRetentionDays: 90, supportLevel: "STANDARD" as const,
      isTrial: false, isCustom: false, sortOrder: 2,
      features: { mobile_clock: true, kiosk: true, csv_export: true, approvals: true, audit_log: true, notifications: true, support_tickets: true, leave_requests: true, permission_requests: true, bulk_schedules: false, multi_branch: false, advanced_reports: false, advanced_geofence: false, api_access: false } },
    { slug: "growth", name: "Growth", nameAr: "نمو", description: "Multi-branch operators needing bulk scheduling and leave management.",
      priceMonthly: 2499, priceAnnual: 24990, maxBranches: 3, maxEmployees: 75, maxManagers: 6, maxKiosks: 3,
      reportsLevel: "ADVANCED" as const, auditRetentionDays: 180, supportLevel: "PRIORITY" as const,
      isTrial: false, isCustom: false, sortOrder: 3,
      features: { mobile_clock: true, kiosk: true, csv_export: true, approvals: true, audit_log: true, notifications: true, support_tickets: true, leave_requests: true, permission_requests: true, bulk_schedules: true, multi_branch: true, advanced_reports: true, advanced_geofence: false, api_access: false } },
    { slug: "pro", name: "Pro", nameAr: "برو", description: "Larger chains needing advanced geofence and API access.",
      priceMonthly: 4999, priceAnnual: 49990, maxBranches: 10, maxEmployees: 250, maxManagers: 20, maxKiosks: 10,
      reportsLevel: "ADVANCED" as const, auditRetentionDays: 365, supportLevel: "PRIORITY" as const,
      isTrial: false, isCustom: false, sortOrder: 4,
      features: { mobile_clock: true, kiosk: true, csv_export: true, approvals: true, audit_log: true, notifications: true, support_tickets: true, leave_requests: true, permission_requests: true, bulk_schedules: true, multi_branch: true, advanced_reports: true, advanced_geofence: true, api_access: true } },
    { slug: "enterprise", name: "Enterprise", nameAr: "إنتربرايز", description: "Custom contracts, dedicated onboarding, and account management.",
      priceMonthly: 0, priceAnnual: 0, maxBranches: 100, maxEmployees: 5000, maxManagers: 500, maxKiosks: 200,
      reportsLevel: "ADVANCED" as const, auditRetentionDays: 730, supportLevel: "PRIORITY" as const,
      isTrial: false, isCustom: true, sortOrder: 5,
      features: { mobile_clock: true, kiosk: true, csv_export: true, approvals: true, audit_log: true, notifications: true, support_tickets: true, leave_requests: true, permission_requests: true, bulk_schedules: true, multi_branch: true, advanced_reports: true, advanced_geofence: true, api_access: true } },
  ];
  const featureLabels: Record<string, string> = {
    mobile_clock: "Mobile clock-in/out", kiosk: "Branch kiosk mode", csv_export: "CSV export (UTF-8 BOM)",
    approvals: "Approval workflows", audit_log: "Audit log", notifications: "In-app notifications",
    support_tickets: "Support tickets", leave_requests: "Leave management", permission_requests: "Permission requests",
    bulk_schedules: "Bulk schedule generation", multi_branch: "Multi-branch management",
    advanced_reports: "Advanced reports", advanced_geofence: "Advanced geofence", api_access: "API access (placeholder)",
  };
  const planMap: Record<string, { id: string }> = {};
  for (const p of plans) {
    const created = await db.plan.upsert({
      where: { slug: p.slug },
      update: { name: p.name, nameAr: p.nameAr, description: p.description, priceMonthly: p.priceMonthly, priceAnnual: p.priceAnnual, maxBranches: p.maxBranches, maxEmployees: p.maxEmployees, maxManagers: p.maxManagers, maxKiosks: p.maxKiosks, reportsLevel: p.reportsLevel, auditRetentionDays: p.auditRetentionDays, supportLevel: p.supportLevel, isTrial: p.isTrial, isCustom: p.isCustom, sortOrder: p.sortOrder, isActive: true },
      create: { slug: p.slug, name: p.name, nameAr: p.nameAr, description: p.description, priceMonthly: p.priceMonthly, priceAnnual: p.priceAnnual, maxBranches: p.maxBranches, maxEmployees: p.maxEmployees, maxManagers: p.maxManagers, maxKiosks: p.maxKiosks, reportsLevel: p.reportsLevel, auditRetentionDays: p.auditRetentionDays, supportLevel: p.supportLevel, isTrial: p.isTrial, isCustom: p.isCustom, sortOrder: p.sortOrder, isActive: true },
    });
    planMap[p.slug] = { id: created.id };
    await db.planFeature.deleteMany({ where: { planId: created.id } });
    for (const [key, enabled] of Object.entries(p.features)) {
      await db.planFeature.create({ data: { planId: created.id, key, label: featureLabels[key] ?? key, enabled } });
    }
    console.log(`  ✓ Plan: ${p.name}`);
  }

  // ─────────────────────────────────────────────
  // 3. System settings
  // ─────────────────────────────────────────────
  await db.systemSetting.upsert({
    where: { isMain: true },
    update: { defaultTrialDays: 14, defaultGracePeriodDays: 7, defaultCurrency: "EGP", manualActivationMode: true, supportEmail: "support@b-attend.app", billingEmail: "billing@b-attend.app", maintenanceMode: false, defaultPlanId: planMap.growth.id, paymentProviderMode: "MANUAL" },
    create: { isMain: true, defaultTrialDays: 14, defaultGracePeriodDays: 7, defaultCurrency: "EGP", manualActivationMode: true, supportEmail: "support@b-attend.app", billingEmail: "billing@b-attend.app", maintenanceMode: false, defaultPlanId: planMap.growth.id, paymentProviderMode: "MANUAL" },
  });
  console.log("  ✓ SystemSetting");

  // ─────────────────────────────────────────────
  // 4. Demo leads
  // ─────────────────────────────────────────────
  const leads = [
    { name: "Ahmed Mansour", company: "Cairo Bite Chain", phone: "+20 100 123 4567", email: "ahmed@cairobite.example", businessType: "RESTAURANT" as const, employeesCount: 60, branchesCount: 4, message: "Interested in attendance + scheduling for 4 branches.", sourcePage: "REQUEST_DEMO" as const, status: "NEW" as const },
    { name: "Mona Adel", company: "FitZone Gyms", phone: "+20 122 555 8899", email: "mona@fitzone.example", businessType: "GYM" as const, employeesCount: 30, branchesCount: 2, message: "Need clock-in for trainers and front-desk.", sourcePage: "CONTACT" as const, status: "CONTACTED" as const },
    { name: "Khaled Sami", company: "NileSecurity Services", phone: "+20 100 777 3322", email: "khaled@nilesec.example", businessType: "SECURITY_COMPANY" as const, employeesCount: 200, branchesCount: 6, message: "Looking for a payroll-ready solution for 200 guards.", sourcePage: "PRICING" as const, status: "QUALIFIED" as const },
  ];
  for (const l of leads) {
    const existing = await db.lead.findFirst({ where: { email: l.email, sourcePage: l.sourcePage } });
    if (existing) {
      await db.lead.update({ where: { id: existing.id }, data: { ...l, assignedToId: platformUserMap["sales@b-attend.app"].id } });
    } else {
      await db.lead.create({ data: { ...l, assignedToId: platformUserMap["sales@b-attend.app"].id, createdById: platformUserMap["sales@b-attend.app"].id } });
    }
    console.log(`  ✓ Lead: ${l.name}`);
  }

  // ─────────────────────────────────────────────
  // 5. Demo tenant "B-Attend Demo Restaurant Group"
  // ─────────────────────────────────────────────
  const existingTenant = await db.tenant.findUnique({ where: { slug: "b-attend-demo" } });
  const tenant = existingTenant ?? await db.tenant.create({
    data: {
      name: "B-Attend Demo Restaurant Group",
      nameAr: "بي اتيند لتجربة المطاعم",
      slug: "b-attend-demo",
      ownerEmail: "owner@b-attend.app",
      ownerName: "Demo Owner",
      ownerPhone: "+20 100 000 0001",
      businessType: "RESTAURANT",
      employeesCount: 15,
      branchesCount: 3,
      city: "Cairo",
      status: "ACTIVE",
      preferredPlanId: planMap.growth.id,
      billingCycle: "MONTHLY",
      activatedAt: new Date(),
    },
  });
  console.log(`  ✓ Tenant: ${tenant.name} (${tenant.id})`);

  // Subscription
  const sub = await db.subscription.upsert({
    where: { tenantId: tenant.id },
    update: { planId: planMap.growth.id, status: "ACTIVE", billingCycle: "MONTHLY", currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), monthlyAmount: 2499, annualAmount: 24990, currency: "EGP" },
    create: { tenantId: tenant.id, planId: planMap.growth.id, status: "ACTIVE", billingCycle: "MONTHLY", currentPeriodStart: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), monthlyAmount: 2499, annualAmount: 24990, currency: "EGP" },
  });
  console.log(`  ✓ Subscription: ACTIVE`);

  // Company settings
  await db.companySettings.upsert({
    where: { companyId: tenant.id },
    update: { industry: "Restaurant", timezone: "Africa/Cairo", currency: "EGP", defaultLanguage: "en", defaultGeofenceRadius: 150, defaultGraceMinutes: 10, defaultOvertimeThresholdMinutes: 480, enableMobileClock: true, enableKioskClock: true, requireApprovalOutsideGeofence: true, requireApprovalOvertime: true, allowNoScheduleClockIn: false, allowManualRequests: true, enableEmployeeSelfService: true, enableBranchManagerApprovals: true, emailNotifications: true, whatsappNotifications: false },
    create: { companyId: tenant.id, industry: "Restaurant", timezone: "Africa/Cairo", currency: "EGP", defaultLanguage: "en", defaultGeofenceRadius: 150, defaultGraceMinutes: 10, defaultOvertimeThresholdMinutes: 480, enableMobileClock: true, enableKioskClock: true, requireApprovalOutsideGeofence: true, requireApprovalOvertime: true, allowNoScheduleClockIn: false, allowManualRequests: true, enableEmployeeSelfService: true, enableBranchManagerApprovals: true, emailNotifications: true, whatsappNotifications: false },
  });
  console.log(`  ✓ CompanySettings`);

  // ─────────────────────────────────────────────
  // 6. Tenant users (owner, hr, manager, manager2, employee)
  // ─────────────────────────────────────────────
  const tenantUsers = [
    { email: "owner@b-attend.app", name: "Demo Owner", role: "COMPANY_OWNER" as const },
    { email: "hr@b-attend.app", name: "Demo HR", role: "HR_ADMIN" as const },
    { email: "manager@b-attend.app", name: "New Cairo Manager", role: "BRANCH_MANAGER" as const },
    { email: "manager2@b-attend.app", name: "Nasr City Manager", role: "BRANCH_MANAGER" as const },
    { email: "employee@b-attend.app", name: "Demo Employee", role: "EMPLOYEE" as const },
  ];
  for (const u of tenantUsers) {
    const existing = await db.user.findUnique({ where: { companyId_email: { companyId: tenant.id, email: u.email } } });
    if (!existing) {
      await db.user.create({ data: { companyId: tenant.id, email: u.email, passwordHash, name: u.name, role: u.role, status: "ACTIVE" } });
    }
    console.log(`  ✓ TenantUser: ${u.email} (${u.role})`);
  }

  // ─────────────────────────────────────────────
  // 7. Branches (3)
  // ─────────────────────────────────────────────
  const branches = [
    { name: "New Cairo", code: "NC", address: "5th Settlement, New Cairo", city: "Cairo", area: "New Cairo", latitude: 30.0254, longitude: 31.4913, geofenceRadius: 200 },
    { name: "Nasr City", code: "NS", address: "Abbas El Akkad, Nasr City", city: "Cairo", area: "Nasr City", latitude: 30.0566, longitude: 31.3654, geofenceRadius: 150 },
    { name: "Maadi", code: "MD", address: "Road 9, Maadi", city: "Cairo", area: "Maadi", latitude: 29.9602, longitude: 31.2569, geofenceRadius: 150 },
  ];
  const branchMap: Record<string, { id: string }> = {};
  for (const b of branches) {
    const existing = await db.branch.findFirst({ where: { companyId: tenant.id, code: b.code } });
    const created = existing ?? await db.branch.create({ data: { companyId: tenant.id, ...b, status: "ACTIVE" } });
    branchMap[b.code] = { id: created.id };
    console.log(`  ✓ Branch: ${b.name}`);
  }

  // ─────────────────────────────────────────────
  // 8. Departments (6)
  // ─────────────────────────────────────────────
  const departments = ["Kitchen", "Service", "Cashier", "Delivery", "Stewarding", "Management"];
  const deptMap: Record<string, { id: string }> = {};
  for (const name of departments) {
    const existing = await db.department.findFirst({ where: { companyId: tenant.id, name } });
    const created = existing ?? await db.department.create({ data: { companyId: tenant.id, name, code: name.slice(0, 3).toUpperCase() } });
    deptMap[name] = { id: created.id };
  }
  console.log(`  ✓ Departments: ${departments.length}`);

  // ─────────────────────────────────────────────
  // 9. Shift policies (5)
  // ─────────────────────────────────────────────
  const policies = [
    { name: "Morning", startTime: "08:00", endTime: "16:00", breakMinutes: 60, lateGraceMinutes: 10, earlyLeaveGraceMinutes: 5, overtimeStartsAfterMinutes: 480, weekendDays: "FRIDAY,SATURDAY" },
    { name: "Evening", startTime: "16:00", endTime: "00:00", breakMinutes: 60, lateGraceMinutes: 10, earlyLeaveGraceMinutes: 5, overtimeStartsAfterMinutes: 480, weekendDays: "FRIDAY,SATURDAY" },
    { name: "Night", startTime: "00:00", endTime: "08:00", breakMinutes: 60, lateGraceMinutes: 10, earlyLeaveGraceMinutes: 5, overtimeStartsAfterMinutes: 480, weekendDays: "FRIDAY,SATURDAY" },
    { name: "Kitchen Double", startTime: "10:00", endTime: "22:00", breakMinutes: 120, lateGraceMinutes: 10, earlyLeaveGraceMinutes: 5, overtimeStartsAfterMinutes: 720, weekendDays: "FRIDAY,SATURDAY" },
    { name: "Part Time", startTime: "16:00", endTime: "22:00", breakMinutes: 0, lateGraceMinutes: 5, earlyLeaveGraceMinutes: 5, overtimeStartsAfterMinutes: 360, weekendDays: "FRIDAY,SATURDAY" },
  ];
  const policyMap: Record<string, { id: string }> = {};
  for (const p of policies) {
    const existing = await db.shiftPolicy.findFirst({ where: { companyId: tenant.id, name: p.name } });
    const created = existing ?? await db.shiftPolicy.create({ data: { companyId: tenant.id, ...p, requiresOvertimeApproval: true, allowsMobileClockIn: true, allowsKioskClockIn: true, allowNoScheduleClockIn: false, status: "ACTIVE" } });
    policyMap[p.name] = { id: created.id };
  }
  console.log(`  ✓ ShiftPolicies: ${policies.length}`);

  // ─────────────────────────────────────────────
  // 10. Employees (15) — distributed across branches/departments
  // ─────────────────────────────────────────────
  const employeeDefs = [
    { code: "EMP001", name: "Ahmed Mansour", phone: "+20 100 111 0001", email: "employee@b-attend.app", branch: "NC", department: "Service", jobTitle: "Waiter", policy: "Morning", managerId: null },
    { code: "EMP002", name: "Sara Adel", phone: "+20 100 111 0002", email: "emp002@b-attend.app", branch: "NC", department: "Service", jobTitle: "Waiter", policy: "Evening", managerId: null },
    { code: "EMP003", name: "Khaled Ibrahim", phone: "+20 100 111 0003", email: "emp003@b-attend.app", branch: "NC", department: "Kitchen", jobTitle: "Chef", policy: "Kitchen Double", managerId: null },
    { code: "EMP004", name: "Mona Sami", phone: "+20 100 111 0004", email: "emp004@b-attend.app", branch: "NC", department: "Cashier", jobTitle: "Cashier", policy: "Morning", managerId: null },
    { code: "EMP005", name: "Youssef Ali", phone: "+20 100 111 0005", email: "emp005@b-attend.app", branch: "NC", department: "Delivery", jobTitle: "Driver", policy: "Evening", managerId: null },
    { code: "EMP006", name: "Fatma Hassan", phone: "+20 100 111 0006", email: "emp006@b-attend.app", branch: "NS", department: "Service", jobTitle: "Waiter", policy: "Morning", managerId: null },
    { code: "EMP007", name: "Omar Khaled", phone: "+20 100 111 0007", email: "emp007@b-attend.app", branch: "NS", department: "Kitchen", jobTitle: "Cook", policy: "Kitchen Double", managerId: null },
    { code: "EMP008", name: "Nour Ahmed", phone: "+20 100 111 0008", email: "emp008@b-attend.app", branch: "NS", department: "Cashier", jobTitle: "Cashier", policy: "Evening", managerId: null },
    { code: "EMP009", name: "Mahmoud Adel", phone: "+20 100 111 0009", email: "emp009@b-attend.app", branch: "NS", department: "Delivery", jobTitle: "Driver", policy: "Evening", managerId: null },
    { code: "EMP010", name: "Heba Samir", phone: "+20 100 111 0010", email: "emp010@b-attend.app", branch: "NS", department: "Stewarding", jobTitle: "Steward", policy: "Morning", managerId: null },
    { code: "EMP011", name: "Tarek Mokhtar", phone: "+20 100 111 0011", email: "emp011@b-attend.app", branch: "MD", department: "Service", jobTitle: "Waiter", policy: "Evening", managerId: null },
    { code: "EMP012", name: "Laila Mostafa", phone: "+20 100 111 0012", email: "emp012@b-attend.app", branch: "MD", department: "Kitchen", jobTitle: "Chef", policy: "Kitchen Double", managerId: null },
    { code: "EMP013", name: "Hossam Tarek", phone: "+20 100 111 0013", email: "emp013@b-attend.app", branch: "MD", department: "Cashier", jobTitle: "Cashier", policy: "Morning", managerId: null },
    { code: "EMP014", name: "Reem Hassan", phone: "+20 100 111 0014", email: "emp014@b-attend.app", branch: "MD", department: "Service", jobTitle: "Hostess", policy: "Part Time", managerId: null },
    { code: "EMP015", name: "Karim Nabil", phone: "+20 100 111 0015", email: "emp015@b-attend.app", branch: "MD", department: "Delivery", jobTitle: "Driver", policy: "Evening", managerId: null },
  ];
  const employeeMap: Record<string, { id: string }> = {};
  for (const e of employeeDefs) {
    const existing = await db.employee.findUnique({ where: { companyId_employeeCode: { companyId: tenant.id, employeeCode: e.code } } });
    const created = existing ?? await db.employee.create({
      data: {
        companyId: tenant.id,
        employeeCode: e.code,
        fullName: e.name,
        phone: e.phone,
        email: e.email,
        jobTitle: e.jobTitle,
        departmentId: deptMap[e.department].id,
        branchId: branchMap[e.branch].id,
        employmentType: "FULL_TIME",
        status: "ACTIVE",
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        defaultShiftPolicyId: policyMap[e.policy].id,
        pinCode: String(1000 + Object.keys(employeeMap).length).padStart(4, "0"),
      },
    });
    employeeMap[e.code] = { id: created.id };
  }
  // Link employee@b-attend.app user to EMP001
  const empUser = await db.user.findUnique({ where: { companyId_email: { companyId: tenant.id, email: "employee@b-attend.app" } } });
  if (empUser) {
    await db.employee.update({ where: { id: employeeMap["EMP001"].id }, data: { userId: empUser.id } });
  }
  console.log(`  ✓ Employees: ${employeeDefs.length}`);

  // ─────────────────────────────────────────────
  // 11. Schedules for the current month (skip Fridays/Saturdays)
  // ─────────────────────────────────────────────
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  let scheduleCount = 0;
  for (const e of employeeDefs) {
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      const day = d.getDay(); // 0=Sun, 5=Fri, 6=Sat
      if (day === 5 || day === 6) continue; // weekend
      if (d > now) break; // don't schedule future beyond today
      const date = new Date(d);
      // Try to find existing schedule
      const existing = await db.schedule.findUnique({
        where: { companyId_employeeId_date: { companyId: tenant.id, employeeId: employeeMap[e.code].id, date } },
      });
      if (existing) continue;
      const policy = policies.find((p) => p.name === e.policy)!;
      const [sh, sm] = policy.startTime.split(":").map(Number);
      const [eh, em] = policy.endTime.split(":").map(Number);
      const expectedStart = new Date(date);
      expectedStart.setHours(sh, sm, 0, 0);
      const expectedEnd = new Date(date);
      expectedEnd.setHours(eh, em, 0, 0);
      if (expectedEnd <= expectedStart) expectedEnd.setDate(expectedEnd.getDate() + 1); // overnight
      await db.schedule.create({
        data: {
          companyId: tenant.id,
          employeeId: employeeMap[e.code].id,
          branchId: branchMap[e.branch].id,
          date,
          shiftPolicyId: policyMap[e.policy].id,
          expectedStart,
          expectedEnd,
          status: "SCHEDULED",
        },
      });
      scheduleCount++;
    }
  }
  console.log(`  ✓ Schedules: ${scheduleCount}`);

  // ─────────────────────────────────────────────
  // 12. Sample punches + attendance for the past 7 days (1 employee = EMP001)
  // ─────────────────────────────────────────────
  const emp1 = employeeMap["EMP001"];
  for (let i = 1; i <= 7; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const dayOfWeek = day.getDay();
    if (dayOfWeek === 5 || dayOfWeek === 6) continue;
    // Find schedule
    const sched = await db.schedule.findUnique({ where: { companyId_employeeId_date: { companyId: tenant.id, employeeId: emp1.id, date: day } } });
    if (!sched) continue;
    // Simulate clock in/out
    const clockIn = new Date(sched.expectedStart ?? day);
    // Some days late
    if (i % 3 === 0) clockIn.setMinutes(clockIn.getMinutes() + 15); // late
    const clockOut = new Date(sched.expectedEnd ?? day);
    if (i % 4 === 0) clockOut.setMinutes(clockOut.getMinutes() - 20); // early leave
    // Skip future-dated punches
    if (clockIn > now) continue;
    await db.punch.create({ data: { companyId: tenant.id, employeeId: emp1.id, branchId: branchMap["NC"].id, scheduleId: sched.id, type: "CLOCK_IN", timestamp: clockIn, latitude: 30.0254, longitude: 31.4913, distanceMeters: 50, insideGeofence: true, source: "MOBILE_WEB", status: "ACCEPTED", userAgent: "seed" } });
    if (clockOut <= now) {
      await db.punch.create({ data: { companyId: tenant.id, employeeId: emp1.id, branchId: branchMap["NC"].id, scheduleId: sched.id, type: "CLOCK_OUT", timestamp: clockOut, latitude: 30.0254, longitude: 31.4913, distanceMeters: 60, insideGeofence: true, source: "MOBILE_WEB", status: "ACCEPTED", userAgent: "seed" } });
    }
  }
  console.log(`  ✓ Sample punches for EMP001`);

  // ─────────────────────────────────────────────
  // 13. Sample approvals
  // ─────────────────────────────────────────────
  const pendingApproval = await db.approvalRequest.findFirst({ where: { companyId: tenant.id, status: "PENDING" } });
  if (!pendingApproval) {
    await db.approvalRequest.create({
      data: { companyId: tenant.id, employeeId: emp1.id, branchId: branchMap["NC"].id, date: new Date(now.getTime() - 24 * 60 * 60 * 1000), type: "OUTSIDE_GEOFENCE", reason: "Was at the bank next door, forgot to clock out before leaving.", status: "PENDING", requestedById: empUser?.id },
    });
    await db.approvalRequest.create({
      data: { companyId: tenant.id, employeeId: employeeMap["EMP003"].id, branchId: branchMap["NC"].id, date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), type: "OVERTIME", reason: "Stayed late to close the kitchen.", status: "PENDING", requestedById: empUser?.id },
    });
    await db.approvalRequest.create({
      data: { companyId: tenant.id, employeeId: employeeMap["EMP006"].id, branchId: branchMap["NS"].id, date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), type: "LEAVE_REQUEST", reason: "Family emergency.", status: "APPROVED", requestedById: empUser?.id, approvedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), managerNotes: "Approved." },
    });
  }
  console.log(`  ✓ Sample approvals`);

  // ─────────────────────────────────────────────
  // 14. Sample invoices + payment (paid + pending + overdue)
  // ─────────────────────────────────────────────
  const paidInvoice = await db.invoice.findFirst({ where: { tenantId: tenant.id, status: "PAID" } });
  if (!paidInvoice) {
    const inv1 = await db.invoice.create({
      data: { tenantId: tenant.id, subscriptionId: sub.id, planId: planMap.growth.id, number: `INV-${tenant.slug.toUpperCase()}-001`, billingPeriodStart: new Date(now.getFullYear(), now.getMonth() - 1, 1), billingPeriodEnd: new Date(now.getFullYear(), now.getMonth(), 0), subtotal: 2499, discount: 0, tax: 0, total: 2499, currency: "EGP", status: "PAID", dueDate: new Date(now.getFullYear(), now.getMonth() - 1, 15), paidAt: new Date(now.getFullYear(), now.getMonth() - 1, 10), paymentMethod: "BANK_TRANSFER", createdById: platformUserMap["billing@b-attend.app"].id },
    });
    await db.payment.create({ data: { tenantId: tenant.id, invoiceId: inv1.id, amount: 2499, currency: "EGP", provider: "BANK_TRANSFER", reference: "BANK-REF-001", status: "CONFIRMED", paidAt: new Date(now.getFullYear(), now.getMonth() - 1, 10), createdById: platformUserMap["billing@b-attend.app"].id } });
    await db.invoice.create({
      data: { tenantId: tenant.id, subscriptionId: sub.id, planId: planMap.growth.id, number: `INV-${tenant.slug.toUpperCase()}-002`, billingPeriodStart: new Date(now.getFullYear(), now.getMonth(), 1), billingPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0), subtotal: 2499, discount: 0, tax: 0, total: 2499, currency: "EGP", status: "PENDING_PAYMENT", dueDate: new Date(now.getFullYear(), now.getMonth(), 15), createdById: platformUserMap["billing@b-attend.app"].id },
    });
    await db.invoice.create({
      data: { tenantId: tenant.id, subscriptionId: sub.id, planId: planMap.growth.id, number: `INV-${tenant.slug.toUpperCase()}-003`, billingPeriodStart: new Date(now.getFullYear(), now.getMonth() - 2, 1), billingPeriodEnd: new Date(now.getFullYear(), now.getMonth() - 1, 0), subtotal: 2499, discount: 0, tax: 0, total: 2499, currency: "EGP", status: "OVERDUE", dueDate: new Date(now.getFullYear(), now.getMonth() - 2, 15), createdById: platformUserMap["billing@b-attend.app"].id },
    });
  }
  console.log(`  ✓ Sample invoices + payment`);

  // ─────────────────────────────────────────────
  // 15. Sample support ticket
  // ─────────────────────────────────────────────
  const existingTicket = await db.supportTicket.findFirst({ where: { companyId: tenant.id } });
  if (!existingTicket) {
    const ticket = await db.supportTicket.create({
      data: { companyId: tenant.id, subject: "How do I export payroll CSV?", category: "Reports", message: "I need to export the payroll report for last month but cannot find the option.", priority: "NORMAL", status: "OPEN", createdByEmail: "owner@b-attend.app" },
    });
    await db.supportMessage.create({ data: { ticketId: ticket.id, authorEmail: "owner@b-attend.app", authorRole: "COMPANY_OWNER", body: "I need to export the payroll report for last month but cannot find the option." } });
    await db.supportMessage.create({ data: { ticketId: ticket.id, authorEmail: "support@b-attend.app", authorRole: "SUPPORT_AGENT", body: "Hi! You can export it from Reports → Payroll Export → click Export CSV. Let me know if you need more help.", isInternal: false } });
  }
  console.log(`  ✓ Sample support ticket`);

  console.log("\n✅ Seed complete.");
  console.log("   Platform accounts (password: demo1234):");
  console.log("     super@b-attend.app    — SUPER_ADMIN");
  console.log("     sales@b-attend.app    — SALES_ADMIN");
  console.log("     support@b-attend.app  — SUPPORT_AGENT");
  console.log("     billing@b-attend.app  — BILLING_ADMIN");
  console.log("   Tenant accounts (password: demo1234):");
  console.log("     owner@b-attend.app    — COMPANY_OWNER");
  console.log("     hr@b-attend.app       — HR_ADMIN");
  console.log("     manager@b-attend.app  — BRANCH_MANAGER (New Cairo)");
  console.log("     manager2@b-attend.app — BRANCH_MANAGER (Nasr City)");
  console.log("     employee@b-attend.app — EMPLOYEE");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
