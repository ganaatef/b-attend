/**
 * Runtime behavioral tests — Authorization enforced in real server actions.
 *
 * These tests invoke the real action handlers (`createScheduleAction`,
 * `clockAction`, `decideRequestAction`) against a real database with the
 * session mocked to the caller's role. Requires DATABASE_URL pointing to a
 * test database:
 *   npx vitest run tests/runtime/authorization.test.ts
 *
 * Each scenario verifies the operation fails AND the database is not mutated.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { getSession } from "@/lib/auth/session";
import { createScheduleAction } from "@/app/(tenant)/actions";
import { clockAction } from "@/app/(tenant)/clock/actions";
import { decideRequestAction } from "@/app/(tenant)/approvals/actions";

const db = new PrismaClient();

let tenantId: string;
let branchA: string;
let branchB: string;
let managerUserId: string;
let employeeUserId: string;
let employeeA: string;
let employeeB: string;
let policyId: string;

function sessionFor(role: string, sub: string) {
  return {
    sub,
    kind: "tenant",
    role,
    tenantId,
    name: "User",
    email: `${role.toLowerCase()}@test.com`,
  } as any;
}

beforeAll(async () => {
  const hash = await bcrypt.hash("TestPass123!", 10);

  const tenant = await db.tenant.create({
    data: {
      name: "Auth Behavioral Tenant",
      slug: `auth-beh-${Date.now()}`,
      ownerEmail: `auth-beh-${Date.now()}@test.com`,
      ownerName: "Auth Owner",
      ownerPhone: "+201000000093",
      status: "ACTIVE",
    },
  });
  tenantId = tenant.id;

  branchA = (
    await db.branch.create({
      data: { companyId: tenantId, name: "Branch A", code: "BA", status: "ACTIVE" },
    })
  ).id;

  branchB = (
    await db.branch.create({
      data: { companyId: tenantId, name: "Branch B", code: "BB", status: "ACTIVE" },
    })
  ).id;

  const manager = await db.user.create({
    data: {
      companyId: tenantId,
      email: `beh-manager-${Date.now()}@test.com`,
      passwordHash: hash,
      name: "Manager",
      role: "BRANCH_MANAGER",
      status: "ACTIVE",
    },
  });
  managerUserId = manager.id;
  await db.branch.update({ where: { id: branchA }, data: { managerId: managerUserId } });

  const empUser = await db.user.create({
    data: {
      companyId: tenantId,
      email: `beh-employee-${Date.now()}@test.com`,
      passwordHash: hash,
      name: "Employee",
      role: "EMPLOYEE",
      status: "ACTIVE",
    },
  });
  employeeUserId = empUser.id;

  employeeA = (
    await db.employee.create({
      data: {
        companyId: tenantId,
        employeeCode: "BEA001",
        fullName: "Emp A",
        branchId: branchA,
        userId: employeeUserId,
        status: "ACTIVE",
      },
    })
  ).id;

  employeeB = (
    await db.employee.create({
      data: {
        companyId: tenantId,
        employeeCode: "BEB001",
        fullName: "Emp B",
        branchId: branchB,
        status: "ACTIVE",
      },
    })
  ).id;

  policyId = (
    await db.shiftPolicy.create({
      data: { companyId: tenantId, name: "Auth Policy", startTime: "09:00", endTime: "17:00" },
    })
  ).id;
});

afterAll(async () => {
  await db.approvalRequest.deleteMany({ where: { companyId: tenantId } });
  await db.punch.deleteMany({ where: { companyId: tenantId } });
  await db.schedule.deleteMany({ where: { companyId: tenantId } });
  await db.shiftPolicy.deleteMany({ where: { companyId: tenantId } });
  await db.employee.deleteMany({ where: { companyId: tenantId } });
  await db.user.deleteMany({ where: { companyId: tenantId } });
  await db.branch.deleteMany({ where: { companyId: tenantId } });
  await db.tenant.deleteMany({ where: { id: tenantId } });
  await db.$disconnect();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Manager cross-branch schedule writes are rejected", () => {
  it("rejects scheduling into an unmanaged branch and does not mutate the DB", async () => {
    vi.mocked(getSession).mockResolvedValue(sessionFor("BRANCH_MANAGER", managerUserId));

    const fd = new FormData();
    fd.set("employeeId", employeeB);
    fd.set("branchId", branchB);
    fd.set("date", "2026-08-12");
    fd.set("shiftPolicyId", policyId);

    const r = await createScheduleAction({}, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Cannot schedule for branches you don't manage");

    const date = new Date("2026-08-12"); date.setHours(0, 0, 0, 0);
    const created = await db.schedule.findFirst({
      where: { companyId: tenantId, employeeId: employeeB, date },
    });
    expect(created).toBeNull();
  });

  it("rejects scheduling an employee who belongs to another branch and does not mutate the DB", async () => {
    vi.mocked(getSession).mockResolvedValue(sessionFor("BRANCH_MANAGER", managerUserId));

    const fd = new FormData();
    fd.set("employeeId", employeeB);
    fd.set("branchId", branchA); // managed, but employee belongs to branch B
    fd.set("date", "2026-08-13");
    fd.set("shiftPolicyId", policyId);

    const r = await createScheduleAction({}, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Employee must belong to the selected branch");

    const date = new Date("2026-08-13"); date.setHours(0, 0, 0, 0);
    const created = await db.schedule.findFirst({
      where: { companyId: tenantId, employeeId: employeeB, date },
    });
    expect(created).toBeNull();
  });
});

describe("Employee cannot clock for another employee", () => {
  it("rejects clock-in for another employee and does not create a punch", async () => {
    vi.mocked(getSession).mockResolvedValue(sessionFor("EMPLOYEE", employeeUserId));

    const fd = new FormData();
    fd.set("employeeId", employeeB); // employee B has no userId == employeeUserId
    fd.set("type", "CLOCK_IN");
    fd.set("latitude", "0");
    fd.set("longitude", "0");
    fd.set("source", "MOBILE_WEB");

    const r = await clockAction({}, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("You can only clock for yourself");

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const punch = await db.punch.findFirst({
      where: { companyId: tenantId, employeeId: employeeB, timestamp: { gte: today, lt: tomorrow } },
    });
    expect(punch).toBeNull();
  });
});

describe("Self-approval is prevented", () => {
  it("rejects a manager approving their own request and leaves it PENDING", async () => {
    vi.mocked(getSession).mockResolvedValue(sessionFor("BRANCH_MANAGER", managerUserId));

    const req = await db.approvalRequest.create({
      data: {
        companyId: tenantId,
        employeeId: employeeA,
        branchId: branchA,
        date: new Date("2026-08-14"),
        type: "MANUAL_CLOCK_IN",
        reason: "Forgot to clock in",
        status: "PENDING",
        requestedById: managerUserId,
      },
    });

    const fd = new FormData();
    fd.set("requestId", req.id);
    fd.set("decision", "APPROVED");

    const r = await decideRequestAction({}, fd);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("your own request");

    const after = await db.approvalRequest.findUnique({ where: { id: req.id } });
    expect(after?.status).toBe("PENDING");
    expect(after?.approvedById).toBeNull();

    await db.approvalRequest.delete({ where: { id: req.id } });
  });
});
