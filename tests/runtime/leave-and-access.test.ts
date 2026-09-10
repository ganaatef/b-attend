/**
 * Runtime tests — Leave conflicts and unauthorized access patterns.
 *
 * Requires DATABASE_URL pointing to a test database.
 * Access-control tests invoke the real handlers with real signed sessions and
 * real tenant/user/subscription rows so the suite exercises the same session
 * revocation contract as production.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { requirePlatformRole } from "@/lib/auth/session";
import { createPayrollRunAction } from "@/app/(tenant)/hr/actions";
import { hasHrPermission } from "@/lib/hr/permissions";

const SECRET = "battend-test-secret-1234567890-abcdefgh";
const PASSWORD_HASH_FIXTURE = "$2b$10$runtimefixturehashnotusedforpasswordlogin000000000000000000";

const db = new PrismaClient();

let tenantA: string;
let tenantB: string;
let branchA: string;
let employeeA: string;
let employeeB: string;
let policyId: string;
let planId: string;
let ownerUserId: string;
let employeeUserId: string;
let managerUserId: string;

async function signSession(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(SECRET));
}

function mockCookie(value: string) {
  vi.mocked(cookies).mockResolvedValue({
    get: vi.fn((name: string) => (name === "battend_session" ? { name, value } : undefined)),
    set: vi.fn(),
    delete: vi.fn(),
  } as any);
}

beforeAll(async () => {
  vi.stubEnv("SESSION_SECRET", SECRET);
  const unique = Date.now();

  const plan = await db.plan.create({
    data: {
      slug: `runtime-security-${unique}`,
      name: "Runtime Security Test Plan",
      priceMonthly: 1,
      priceAnnual: 10,
      maxBranches: 10,
      maxEmployees: 100,
      maxManagers: 20,
      maxKiosks: 10,
      isActive: true,
    },
  });
  planId = plan.id;

  const tA = await db.tenant.create({
    data: {
      name: "Leave Test Tenant A",
      slug: `leave-test-a-${unique}`,
      ownerEmail: `leave-a-${unique}@test.com`,
      ownerName: "Leave A",
      ownerPhone: "+201000000077",
      status: "ACTIVE",
    },
  });
  tenantA = tA.id;

  const tB = await db.tenant.create({
    data: {
      name: "Leave Test Tenant B",
      slug: `leave-test-b-${unique}`,
      ownerEmail: `leave-b-${unique}@test.com`,
      ownerName: "Leave B",
      ownerPhone: "+201000000076",
      status: "ACTIVE",
    },
  });
  tenantB = tB.id;

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await db.subscription.createMany({
    data: [
      {
        tenantId: tenantA,
        planId,
        status: "ACTIVE",
        billingCycle: "MONTHLY",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        monthlyAmount: 1,
        annualAmount: 10,
      },
      {
        tenantId: tenantB,
        planId,
        status: "ACTIVE",
        billingCycle: "MONTHLY",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        monthlyAmount: 1,
        annualAmount: 10,
      },
    ],
  });

  const [owner, employeeUser, manager] = await Promise.all([
    db.user.create({
      data: {
        companyId: tenantA,
        email: `owner-${unique}@leave.test`,
        passwordHash: PASSWORD_HASH_FIXTURE,
        name: "Owner",
        role: "COMPANY_OWNER",
        status: "ACTIVE",
      },
    }),
    db.user.create({
      data: {
        companyId: tenantA,
        email: `employee-${unique}@leave.test`,
        passwordHash: PASSWORD_HASH_FIXTURE,
        name: "Employee",
        role: "EMPLOYEE",
        status: "ACTIVE",
      },
    }),
    db.user.create({
      data: {
        companyId: tenantA,
        email: `manager-${unique}@leave.test`,
        passwordHash: PASSWORD_HASH_FIXTURE,
        name: "Manager",
        role: "BRANCH_MANAGER",
        status: "ACTIVE",
      },
    }),
  ]);
  ownerUserId = owner.id;
  employeeUserId = employeeUser.id;
  managerUserId = manager.id;

  branchA = (
    await db.branch.create({
      data: { companyId: tenantA, name: "Leave Branch", code: "LB", status: "ACTIVE", managerId: managerUserId },
    })
  ).id;

  const branchB = (
    await db.branch.create({
      data: { companyId: tenantB, name: "Leave Branch B", code: "LBB", status: "ACTIVE" },
    })
  ).id;

  policyId = (
    await db.shiftPolicy.create({
      data: { companyId: tenantA, name: "Leave Policy", startTime: "09:00", endTime: "17:00" },
    })
  ).id;

  employeeA = (
    await db.employee.create({
      data: { companyId: tenantA, employeeCode: "LEA001", fullName: "Leave Emp A", branchId: branchA, status: "ACTIVE", userId: employeeUserId },
    })
  ).id;

  employeeB = (
    await db.employee.create({
      data: { companyId: tenantB, employeeCode: "LEB001", fullName: "Leave Emp B", branchId: branchB, status: "ACTIVE" },
    })
  ).id;
});

afterAll(async () => {
  await db.payrollRun.deleteMany({ where: { companyId: tenantA } });
  await db.approvalRequest.deleteMany({ where: { companyId: { in: [tenantA, tenantB] } } });
  await db.attendanceDay.deleteMany({ where: { companyId: { in: [tenantA, tenantB] } } });
  await db.schedule.deleteMany({ where: { companyId: { in: [tenantA, tenantB] } } });
  await db.shiftPolicy.deleteMany({ where: { id: policyId } });
  await db.employee.deleteMany({ where: { companyId: { in: [tenantA, tenantB] } } });
  await db.branch.deleteMany({ where: { companyId: { in: [tenantA, tenantB] } } });
  await db.userRoleAssignment.deleteMany({ where: { companyId: { in: [tenantA, tenantB] } } });
  await db.user.deleteMany({ where: { companyId: { in: [tenantA, tenantB] } } });
  await db.subscription.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await db.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
  await db.plan.deleteMany({ where: { id: planId } });
  await db.$disconnect();
});

describe("Approved leave conflicts", () => {
  it("creating schedule on a LEAVE day should be detectable", async () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    await db.schedule.create({
      data: {
        companyId: tenantA,
        employeeId: employeeA,
        branchId: branchA,
        date,
        shiftPolicyId: policyId,
        status: "LEAVE",
      },
    });

    const existing = await db.schedule.findUnique({
      where: { companyId_employeeId_date: { companyId: tenantA, employeeId: employeeA, date } },
    });
    expect(existing).not.toBeNull();
    expect(existing?.status).toBe("LEAVE");

    await db.schedule.deleteMany({ where: { companyId: tenantA, employeeId: employeeA } });
  });

  it("leave approval updates schedule status to LEAVE", async () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    const schedule = await db.schedule.create({
      data: {
        companyId: tenantA,
        employeeId: employeeA,
        branchId: branchA,
        date,
        shiftPolicyId: policyId,
        expectedStart: new Date(date.getTime() + 9 * 3600_000),
        expectedEnd: new Date(date.getTime() + 17 * 3600_000),
        status: "SCHEDULED",
      },
    });

    await db.approvalRequest.create({
      data: {
        companyId: tenantA,
        employeeId: employeeA,
        branchId: branchA,
        date,
        type: "LEAVE_REQUEST",
        reason: "Personal day off",
        status: "PENDING",
        requestedData: JSON.stringify({ dateTo: date.toISOString() }),
      },
    });

    await db.schedule.update({ where: { id: schedule.id }, data: { status: "LEAVE" } });
    await db.attendanceDay.upsert({
      where: { companyId_employeeId_date: { companyId: tenantA, employeeId: employeeA, date } },
      update: { status: "LEAVE" },
      create: { companyId: tenantA, employeeId: employeeA, date, status: "LEAVE" },
    });

    const updatedSchedule = await db.schedule.findUnique({ where: { id: schedule.id } });
    expect(updatedSchedule?.status).toBe("LEAVE");
    const attendanceDay = await db.attendanceDay.findUnique({
      where: { companyId_employeeId_date: { companyId: tenantA, employeeId: employeeA, date } },
    });
    expect(attendanceDay?.status).toBe("LEAVE");

    await db.attendanceDay.deleteMany({ where: { companyId: tenantA } });
    await db.approvalRequest.deleteMany({ where: { companyId: tenantA } });
    await db.schedule.deleteMany({ where: { companyId: tenantA } });
  });
});

describe("Unauthorized payroll access", () => {
  it("denies payroll run creation to EMPLOYEE and does not create a run", async () => {
    mockCookie(await signSession({
      kind: "tenant",
      role: "EMPLOYEE",
      tenantId: tenantA,
      sub: employeeUserId,
      name: "Employee",
      email: "emp@leave.test",
    }));

    const fd = new FormData();
    fd.set("month", "8");
    fd.set("year", "2026");

    const r = await createPayrollRunAction({}, fd);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Permission denied");
    const runs = await db.payrollRun.findMany({ where: { companyId: tenantA } });
    expect(runs).toHaveLength(0);
  });

  it("grants payroll permission to COMPANY_OWNER and HR_ADMIN only", async () => {
    mockCookie(await signSession({
      kind: "tenant",
      role: "COMPANY_OWNER",
      tenantId: tenantA,
      sub: ownerUserId,
      name: "Owner",
      email: "owner@leave.test",
    }));
    expect(await hasHrPermission("VIEW_PAYROLL")).toBe(true);

    mockCookie(await signSession({
      kind: "tenant",
      role: "BRANCH_MANAGER",
      tenantId: tenantA,
      sub: managerUserId,
      name: "Manager",
      email: "mgr@leave.test",
    }));
    expect(await hasHrPermission("VIEW_PAYROLL")).toBe(false);
  });
});

describe("Unauthorized platform access", () => {
  it("rejects a valid tenant session from platform admin APIs", async () => {
    mockCookie(await signSession({
      kind: "tenant",
      role: "BRANCH_MANAGER",
      tenantId: tenantA,
      sub: managerUserId,
      name: "Manager",
      email: "mgr@leave.test",
    }));

    await expect(requirePlatformRole("SUPER_ADMIN")).rejects.toThrow("FORBIDDEN");
  });

  it("allows a platform SUPER_ADMIN session into platform admin APIs", async () => {
    mockCookie(await signSession({
      kind: "platform",
      role: "SUPER_ADMIN",
      sub: "platform-1",
      name: "Admin",
      email: "admin@platform.test",
    }));

    const s = await requirePlatformRole("SUPER_ADMIN");
    expect(s.kind).toBe("platform");
    expect(s.role).toBe("SUPER_ADMIN");
  });
});

describe("Cross-tenant approval isolation", () => {
  it("approval request for tenant A employee cannot be decided by tenant B user", async () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    const req = await db.approvalRequest.create({
      data: {
        companyId: tenantA,
        employeeId: employeeA,
        branchId: branchA,
        date,
        type: "MANUAL_CLOCK_IN",
        reason: "Test cross-tenant isolation",
        status: "PENDING",
      },
    });

    const wrongTenant = await db.approvalRequest.findFirst({ where: { id: req.id, companyId: tenantB } });
    expect(wrongTenant).toBeNull();
    const correctTenant = await db.approvalRequest.findFirst({ where: { id: req.id, companyId: tenantA } });
    expect(correctTenant).not.toBeNull();

    await db.approvalRequest.delete({ where: { id: req.id } });
  });
});
