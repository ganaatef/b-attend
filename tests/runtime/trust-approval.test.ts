import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { decideRequestAction } from "@/app/(tenant)/approvals/actions";

const db = new PrismaClient();
const SECRET = "battend-trust-approval-runtime-secret-123456";
const PASSWORD_HASH_FIXTURE = "$2b$10$runtimefixturehashnotusedforpasswordlogin000000000000000000";

let tenantId: string;
let planId: string;
let branchId: string;
let employeeId: string;
let employeeUserId: string;
let managerUserId: string;

async function signManagerSession() {
  return new SignJWT({
    kind: "tenant",
    role: "BRANCH_MANAGER",
    tenantId,
    sub: managerUserId,
    name: "Trust Reviewer",
    email: "reviewer@trust.test",
    sessionVersion: 1,
  })
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
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const plan = await db.plan.create({
    data: {
      slug: `trust-review-${unique}`,
      name: "Trust Review Runtime Plan",
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

  const tenant = await db.tenant.create({
    data: {
      name: "Trust Review Runtime Tenant",
      slug: `trust-review-tenant-${unique}`,
      ownerEmail: `owner-${unique}@trust.test`,
      ownerName: "Trust Owner",
      ownerPhone: "+201000000088",
      status: "ACTIVE",
    },
  });
  tenantId = tenant.id;

  const now = new Date();
  await db.subscription.create({
    data: {
      tenantId,
      planId,
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      monthlyAmount: 1,
      annualAmount: 10,
    },
  });

  const [manager, employeeUser] = await Promise.all([
    db.user.create({
      data: {
        companyId: tenantId,
        email: `reviewer-${unique}@trust.test`,
        passwordHash: PASSWORD_HASH_FIXTURE,
        name: "Trust Reviewer",
        role: "BRANCH_MANAGER",
        status: "ACTIVE",
      },
    }),
    db.user.create({
      data: {
        companyId: tenantId,
        email: `employee-${unique}@trust.test`,
        passwordHash: PASSWORD_HASH_FIXTURE,
        name: "Trust Employee",
        role: "EMPLOYEE",
        status: "ACTIVE",
      },
    }),
  ]);
  managerUserId = manager.id;
  employeeUserId = employeeUser.id;

  const branch = await db.branch.create({
    data: {
      companyId: tenantId,
      name: "Trust Branch",
      code: `TR-${unique}`,
      status: "ACTIVE",
      managerId: managerUserId,
    },
  });
  branchId = branch.id;

  const employee = await db.employee.create({
    data: {
      companyId: tenantId,
      employeeCode: `TE-${unique}`,
      fullName: "Trust Employee",
      branchId,
      userId: employeeUserId,
      status: "ACTIVE",
    },
  });
  employeeId = employee.id;
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { companyId: tenantId } });
  await db.approvalRequest.deleteMany({ where: { companyId: tenantId } });
  await db.attendanceDay.deleteMany({ where: { companyId: tenantId } });
  await db.punch.deleteMany({ where: { companyId: tenantId } });
  await db.employee.deleteMany({ where: { companyId: tenantId } });
  await db.branch.deleteMany({ where: { companyId: tenantId } });
  await db.userRoleAssignment.deleteMany({ where: { companyId: tenantId } });
  await db.tenantRolePermission.deleteMany({ where: { companyId: tenantId } });
  await db.tenantRole.deleteMany({ where: { companyId: tenantId } });
  await db.user.deleteMany({ where: { companyId: tenantId } });
  await db.subscription.delete({ where: { tenantId } });
  await db.tenant.delete({ where: { id: tenantId } });
  await db.plan.delete({ where: { id: planId } });
  await db.$disconnect();
});

async function makeTrustReview() {
  const now = new Date();
  const punch = await db.punch.create({
    data: {
      companyId: tenantId,
      employeeId,
      branchId,
      type: "CLOCK_IN",
      timestamp: now,
      source: "MOBILE_APP",
      status: "NEEDS_APPROVAL",
      insideGeofence: true,
      distanceMeters: 4,
      deviceInfo: JSON.stringify({ trust: { score: 62, riskLevel: "MEDIUM", decision: "REVIEW", policyVersion: "trust-v1.0" } }),
    },
  });
  const request = await db.approvalRequest.create({
    data: {
      companyId: tenantId,
      employeeId,
      branchId,
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      type: "ATTENDANCE_ADJUSTMENT",
      reason: "Attendance Trust Engine review",
      status: "PENDING",
      requestedById: employeeUserId,
      relatedPunchId: punch.id,
    },
  });
  return { punch, request };
}

describe("Trust review approval lifecycle", () => {
  it("approval resolves the related punch to ACCEPTED", async () => {
    mockCookie(await signManagerSession());
    const { punch, request } = await makeTrustReview();

    const form = new FormData();
    form.set("requestId", request.id);
    form.set("decision", "APPROVED");
    const result = await decideRequestAction({}, form);

    expect(result.ok).toBe(true);
    const updatedPunch = await db.punch.findUnique({ where: { id: punch.id } });
    const updatedRequest = await db.approvalRequest.findUnique({ where: { id: request.id } });
    expect(updatedPunch?.status).toBe("ACCEPTED");
    expect(updatedRequest?.status).toBe("APPROVED");
  });

  it("rejection resolves the related punch to REJECTED", async () => {
    mockCookie(await signManagerSession());
    const { punch, request } = await makeTrustReview();

    const form = new FormData();
    form.set("requestId", request.id);
    form.set("decision", "REJECTED");
    form.set("managerNotes", "Risk evidence not accepted");
    const result = await decideRequestAction({}, form);

    expect(result.ok).toBe(true);
    const updatedPunch = await db.punch.findUnique({ where: { id: punch.id } });
    const updatedRequest = await db.approvalRequest.findUnique({ where: { id: request.id } });
    expect(updatedPunch?.status).toBe("REJECTED");
    expect(updatedRequest?.status).toBe("REJECTED");
  });
});
