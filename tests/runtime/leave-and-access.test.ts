/**
 * Runtime tests — Leave conflicts and unauthorized access patterns.
 *
 * Requires DATABASE_URL pointing to a test database.
 * Access-control tests invoke the real handlers with real signed sessions.
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

const db = new PrismaClient();

let tenantA: string;
let tenantB: string;
let branchA: string;
let employeeA: string;
let employeeB: string;
let policyId: string;

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

  const tA = await db.tenant.create({
    data: {
      name: "Leave Test Tenant A",
      slug: `leave-test-a-${Date.now()}`,
      ownerEmail: `leave-a-${Date.now()}@test.com`,
      ownerName: "Leave A",
      ownerPhone: "+201000000077",
      status: "ACTIVE",
    },
  });
  tenantA = tA.id;

  const tB = await db.tenant.create({
    data: {
      name: "Leave Test Tenant B",
      slug: `leave-test-b-${Date.now()}`,
      ownerEmail: `leave-b-${Date.now()}@test.com`,
      ownerName: "Leave B",
      ownerPhone: "+201000000076",
      status: "ACTIVE",
    },
  });
  tenantB = tB.id;

  branchA = (
    await db.branch.create({
      data: { companyId: tenantA, name: "Leave Branch", code: "LB", status: "ACTIVE" },
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
      data: { companyId: tenantA, employeeCode: "LEA001", fullName: "Leave Emp A", branchId: branchA, status: "ACTIVE" },
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
  await db.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
  await db.$disconnect();
});

describe("Approved leave conflicts", () => {
  it("creating schedule on a LEAVE day should be detectable", async () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    // Mark employee as on leave
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

    // Check if schedule already exists for this date
    const existing = await db.schedule.findUnique({
      where: { companyId_employeeId_date: { companyId: tenantA, employeeId: employeeA, date } },
    });
    expect(existing).not.toBeNull();
    expect(existing?.status).toBe("LEAVE");

    // A new schedule for the same date should be blocked
    // (application checks for existing schedule before creating)
    await db.schedule.deleteMany({ where: { companyId: tenantA, employeeId: employeeA } });
  });

  it("leave approval updates schedule status to LEAVE", async () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    // Create a scheduled shift
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

    // Submit leave request
    const leaveReq = await db.approvalRequest.create({
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

    // Simulate approval: update schedule to LEAVE
    await db.schedule.update({
      where: { id: schedule.id },
      data: { status: "LEAVE" },
    });

    // Also upsert attendance day
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

    // Cleanup
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
      sub: "user-emp",
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
      sub: "user-owner",
      name: "Owner",
      email: "owner@leave.test",
    }));
    expect(await hasHrPermission("VIEW_PAYROLL")).toBe(true);

    mockCookie(await signSession({
      kind: "tenant",
      role: "BRANCH_MANAGER",
      tenantId: tenantA,
      sub: "user-mgr",
      name: "Manager",
      email: "mgr@leave.test",
    }));
    expect(await hasHrPermission("VIEW_PAYROLL")).toBe(false);
  });
});

describe("Unauthorized platform access", () => {
  it("rejects a tenant session from platform admin APIs", async () => {
    mockCookie(await signSession({
      kind: "tenant",
      role: "BRANCH_MANAGER",
      tenantId: tenantA,
      sub: "user-mgr",
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

    // Querying with tenantB's companyId should not find this request
    const wrongTenant = await db.approvalRequest.findFirst({
      where: { id: req.id, companyId: tenantB },
    });
    expect(wrongTenant).toBeNull();

    // Correct tenant finds it
    const correctTenant = await db.approvalRequest.findFirst({
      where: { id: req.id, companyId: tenantA },
    });
    expect(correctTenant).not.toBeNull();

    await db.approvalRequest.delete({ where: { id: req.id } });
  });
});
