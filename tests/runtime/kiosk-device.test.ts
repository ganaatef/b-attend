/**
 * Runtime behavioral tests — Kiosk device trust + PIN authentication.
 *
 * These tests invoke the real `kioskLookupAction` handler against a real
 * database (mocked session only). Requires DATABASE_URL pointing to a test
 * database:
 *   npx vitest run tests/runtime/kiosk-device.test.ts
 *
 * Evidence is behavioral (handler results + DB state), not source patterns.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getSession } from "@/lib/auth/session";
import { kioskLookupAction } from "@/app/(tenant)/clock/actions";
import { generateDeviceSecret } from "@/lib/kiosk/kiosk-auth";

const db = new PrismaClient();

let tenantA: string;
let tenantB: string;
let branchA: string;
let branchB: string;
let employeeId: string;
let deviceActive: string;
let deviceActiveSecret: string;
let deviceRevoked: string;
let deviceOtherBranch: string;
let deviceOtherTenant: string;
let pinHash: string;

function makeForm(overrides: Record<string, string>) {
  const fd = new FormData();
  fd.set("branchId", branchA);
  fd.set("code", "KD001");
  fd.set("pin", "1234");
  fd.set("deviceIdentifier", deviceActive);
  fd.set("deviceSecret", deviceActiveSecret);
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

beforeAll(async () => {
  pinHash = await bcrypt.hash("1234", 10);

  const tA = await db.tenant.create({
    data: {
      name: "Kiosk Behavioral Tenant A",
      slug: `kiosk-beh-a-${Date.now()}`,
      ownerEmail: `kiosk-beh-a-${Date.now()}@test.com`,
      ownerName: "Kiosk A",
      ownerPhone: "+201000000091",
      status: "ACTIVE",
    },
  });
  tenantA = tA.id;

  const tB = await db.tenant.create({
    data: {
      name: "Kiosk Behavioral Tenant B",
      slug: `kiosk-beh-b-${Date.now()}`,
      ownerEmail: `kiosk-beh-b-${Date.now()}@test.com`,
      ownerName: "Kiosk B",
      ownerPhone: "+201000000092",
      status: "ACTIVE",
    },
  });
  tenantB = tB.id;

  branchA = (
    await db.branch.create({
      data: { companyId: tenantA, name: "Kiosk Branch A", code: "KBA", status: "ACTIVE" },
    })
  ).id;

  branchB = (
    await db.branch.create({
      data: { companyId: tenantA, name: "Kiosk Branch B", code: "KBB", status: "ACTIVE" },
    })
  ).id;

  await db.branch.create({
    data: { companyId: tenantB, name: "Kiosk Branch B2", code: "KBB2", status: "ACTIVE" },
  });

  const emp = await db.employee.create({
    data: {
      companyId: tenantA,
      employeeCode: "KD001",
      fullName: "Kiosk Employee",
      branchId: branchA,
      pinHash,
      status: "ACTIVE",
    },
  });
  employeeId = emp.id;

  deviceActiveSecret = generateDeviceSecret();
  deviceActive = (
    await db.kioskDevice.create({
      data: {
        companyId: tenantA,
        branchId: branchA,
        name: "Reception Kiosk",
        deviceIdentifier: `kiosk-beh-active-${Date.now()}`,
        secretHash: await bcrypt.hash(deviceActiveSecret, 10),
        status: "ACTIVE",
        activatedAt: new Date(),
      },
    })
  ).deviceIdentifier;

  deviceRevoked = (
    await db.kioskDevice.create({
      data: {
        companyId: tenantA,
        branchId: branchA,
        name: "Old Kiosk",
        deviceIdentifier: `kiosk-beh-revoked-${Date.now()}`,
        secretHash: await bcrypt.hash(generateDeviceSecret(), 10),
        status: "REVOKED",
        activatedAt: new Date(),
        revokedAt: new Date(),
      },
    })
  ).deviceIdentifier;

  deviceOtherBranch = (
    await db.kioskDevice.create({
      data: {
        companyId: tenantA,
        branchId: branchB,
        name: "Branch B Kiosk",
        deviceIdentifier: `kiosk-beh-other-branch-${Date.now()}`,
        secretHash: await bcrypt.hash(generateDeviceSecret(), 10),
        status: "ACTIVE",
        activatedAt: new Date(),
      },
    })
  ).deviceIdentifier;

  deviceOtherTenant = (
    await db.kioskDevice.create({
      data: {
        companyId: tenantB,
        branchId: branchB,
        name: "Tenant B Kiosk",
        deviceIdentifier: `kiosk-beh-other-tenant-${Date.now()}`,
        secretHash: await bcrypt.hash(generateDeviceSecret(), 10),
        status: "ACTIVE",
        activatedAt: new Date(),
      },
    })
  ).deviceIdentifier;
});

afterAll(async () => {
  await db.kioskDevice.deleteMany({ where: { companyId: { in: [tenantA, tenantB] } } });
  await db.employee.deleteMany({ where: { companyId: tenantA } });
  await db.branch.deleteMany({ where: { companyId: { in: [tenantA, tenantB] } } });
  await db.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
  await db.$disconnect();
});

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue({
    sub: "user-kiosk-owner",
    kind: "tenant",
    role: "COMPANY_OWNER",
    tenantId: tenantA,
    name: "Owner",
    email: "owner@kiosk.test",
  } as any);
});

describe("kioskLookupAction — device trust (behavioral, real DB)", () => {
  it("succeeds with an ACTIVE device bound to the tenant and branch", async () => {
    const r = await kioskLookupAction({}, makeForm({}));

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.employee.employeeCode).toBe("KD001");
      expect(r.employee.id).toBe(employeeId);
    }
  });

  it("rejects a REVOKED device", async () => {
    const r = await kioskLookupAction({}, makeForm({ deviceIdentifier: deviceRevoked }));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("not authorized");
  });

  it("rejects a wrong-branch device", async () => {
    const r = await kioskLookupAction({}, makeForm({ deviceIdentifier: deviceOtherBranch }));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("not authorized");
  });

  it("rejects a wrong-tenant device", async () => {
    const r = await kioskLookupAction({}, makeForm({ deviceIdentifier: deviceOtherTenant }));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("not authorized");
  });

  it("rejects an unknown device", async () => {
    const r = await kioskLookupAction({}, makeForm({ deviceIdentifier: "kiosk-does-not-exist" }));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("not authorized");
  });

  it("rejects a missing device identifier", async () => {
    const r = await kioskLookupAction({}, makeForm({ deviceIdentifier: "" }));

    // Empty input is rejected at schema validation, before any device or
    // employee lookup — no enumeration, no data returned.
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).not.toContain("KD001");
      expect(r.error).not.toContain("1234");
    }
  });

  it("rejects a missing device secret", async () => {
    const r = await kioskLookupAction({}, makeForm({ deviceSecret: "" }));

    // Empty input is rejected at schema validation, before any device or
    // employee lookup — no enumeration, no data returned.
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).not.toContain("KD001");
      expect(r.error).not.toContain(deviceActiveSecret);
    }
  });

  it("rejects a wrong device secret", async () => {
    const r = await kioskLookupAction({}, makeForm({ deviceSecret: "wrong-secret-00000000000000000000" }));

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("not authorized");
      expect(r.error).not.toContain("wrong-secret");
    }
  });

  it("rejects a wrong PIN without leaking data", async () => {
    const r = await kioskLookupAction({}, makeForm({ pin: "0000" }));

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("Invalid employee code or PIN");
      expect(r.error).not.toContain("0000");
    }
  });

  it("records a device rejection in the tenant audit log without PIN data", async () => {
    const r = await kioskLookupAction({}, makeForm({ deviceIdentifier: deviceRevoked }));
    expect(r.ok).toBe(false);

    const event = await db.auditLog.findFirst({
      where: { companyId: tenantA, action: "KIOSK_DEVICE_REJECTED" },
      orderBy: { createdAt: "desc" },
    });
    expect(event).not.toBeNull();
    expect(event?.afterData ?? "").not.toContain("1234");
  });
});
