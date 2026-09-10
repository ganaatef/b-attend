import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { cookies } from "next/headers";
import { clockAction } from "@/app/(tenant)/clock/actions";

const db = new PrismaClient();
const SECRET = "battend-trust-clock-runtime-secret-123456789";
const PASSWORD_HASH_FIXTURE = "$2b$10$runtimefixturehashnotusedforpasswordlogin000000000000000000";

let tenantId: string;
let planId: string;
let ownerUserId: string;
let employeeId: string;

function mockCookie(value: string) {
  vi.mocked(cookies).mockResolvedValue({
    get: vi.fn((name: string) => (name === "battend_session" ? { name, value } : undefined)),
    set: vi.fn(),
    delete: vi.fn(),
  } as any);
}

async function signOwnerSession() {
  return new SignJWT({
    kind: "tenant",
    role: "COMPANY_OWNER",
    tenantId,
    sub: ownerUserId,
    name: "Trust Owner",
    email: "owner@trust-clock.test",
    sessionVersion: 1,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(SECRET));
}

beforeAll(async () => {
  vi.stubEnv("SESSION_SECRET", SECRET);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const plan = await db.plan.create({
    data: {
      slug: `trust-clock-${unique}`,
      name: "Trust Clock Runtime Plan",
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
      name: "Trust Clock Runtime Tenant",
      slug: `trust-clock-tenant-${unique}`,
      ownerEmail: `owner-${unique}@trust-clock.test`,
      ownerName: "Trust Owner",
      ownerPhone: "+201000000077",
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

  const owner = await db.user.create({
    data: {
      companyId: tenantId,
      email: `owner-${unique}@trust-clock.test`,
      passwordHash: PASSWORD_HASH_FIXTURE,
      name: "Trust Owner",
      role: "COMPANY_OWNER",
      status: "ACTIVE",
    },
  });
  ownerUserId = owner.id;

  const branch = await db.branch.create({
    data: {
      companyId: tenantId,
      name: "Trust Clock Branch",
      code: `TC-${unique}`,
      latitude: 30.0444,
      longitude: 31.2357,
      geofenceRadius: 150,
      status: "ACTIVE",
    },
  });

  const employee = await db.employee.create({
    data: {
      companyId: tenantId,
      employeeCode: `TCE-${unique}`,
      fullName: "Trust Clock Employee",
      branchId: branch.id,
      status: "ACTIVE",
    },
  });
  employeeId = employee.id;

  await db.companySettings.create({
    data: {
      companyId: tenantId,
      requireApprovalOutsideGeofence: true,
      trustReviewBelow: 75,
      trustRejectBelow: 30,
      trustBlockCriticalRisk: false,
    },
  });
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { companyId: tenantId } });
  await db.approvalRequest.deleteMany({ where: { companyId: tenantId } });
  await db.attendanceDay.deleteMany({ where: { companyId: tenantId } });
  await db.punch.deleteMany({ where: { companyId: tenantId } });
  await db.employee.deleteMany({ where: { companyId: tenantId } });
  await db.branch.deleteMany({ where: { companyId: tenantId } });
  await db.companySettings.deleteMany({ where: { companyId: tenantId } });
  await db.user.deleteMany({ where: { companyId: tenantId } });
  await db.subscription.delete({ where: { tenantId } });
  await db.tenant.delete({ where: { id: tenantId } });
  await db.plan.delete({ where: { id: planId } });
  await db.$disconnect();
});

describe("attendance trust persistence", () => {
  it("atomically creates a normalized assessment and linked approval for a risky punch", async () => {
    mockCookie(await signOwnerSession());

    const form = new FormData();
    form.set("employeeId", employeeId);
    form.set("type", "CLOCK_IN");
    form.set("latitude", "29.0000");
    form.set("longitude", "30.0000");
    form.set("accuracyMeters", "8");
    form.set("source", "MOBILE_WEB");

    const result = await clockAction({}, form);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("NEEDS_APPROVAL");
    expect(result.approvalRequired).toBe(true);

    const punch = await db.punch.findUnique({
      where: { id: result.punchId! },
      include: { trustAssessment: true },
    });
    expect(punch?.trustAssessment).toBeTruthy();
    expect(punch?.trustAssessment?.reviewStatus).toBe("PENDING");
    expect(punch?.trustAssessment?.policyVersion).toContain("tenant-trust-v1");

    const approval = await db.approvalRequest.findFirst({
      where: { companyId: tenantId, relatedPunchId: result.punchId },
    });
    expect(approval).toBeTruthy();
    expect(approval?.status).toBe("PENDING");
    expect(approval?.type).toBe("OUTSIDE_GEOFENCE");
  });
});
