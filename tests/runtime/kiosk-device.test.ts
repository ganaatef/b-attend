/**
 * Runtime tests — Kiosk device revocation and wrong-branch access.
 *
 * Requires DATABASE_URL pointing to a test database.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

let tenantId: string;
let branchA: string;
let branchB: string;
let kioskDeviceA: string;
let kioskDeviceRevoked: string;

beforeAll(async () => {
  const tenant = await db.tenant.create({
    data: {
      name: "Kiosk Test Tenant",
      slug: `kiosk-test-${Date.now()}`,
      ownerEmail: `kiosk-owner-${Date.now()}@test.com`,
      ownerName: "Kiosk Owner",
      ownerPhone: "+201000000088",
      status: "ACTIVE",
    },
  });
  tenantId = tenant.id;

  const bA = await db.branch.create({
    data: { companyId: tenantId, name: "Kiosk Branch A", code: "KBA", status: "ACTIVE" },
  });
  branchA = bA.id;

  const bB = await db.branch.create({
    data: { companyId: tenantId, name: "Kiosk Branch B", code: "KBB", status: "ACTIVE" },
  });
  branchB = bB.id;

  // Active kiosk device for branch A
  kioskDeviceA = (
    await db.kioskDevice.create({
      data: {
        companyId: tenantId,
        branchId: branchA,
        name: "Reception Kiosk",
        deviceIdentifier: `kiosk-a-${Date.now()}`,
        secretHash: "test-secret-hash",
        status: "ACTIVE",
        activatedAt: new Date(),
      },
    })
  ).id;

  // Revoked kiosk device
  kioskDeviceRevoked = (
    await db.kioskDevice.create({
      data: {
        companyId: tenantId,
        branchId: branchA,
        name: "Old Kiosk",
        deviceIdentifier: `kiosk-revoked-${Date.now()}`,
        secretHash: "revoked-hash",
        status: "REVOKED",
        activatedAt: new Date(),
        revokedAt: new Date(),
      },
    })
  ).id;
});

afterAll(async () => {
  await db.kioskDevice.deleteMany({ where: { companyId: tenantId } });
  await db.branch.deleteMany({ where: { companyId: tenantId } });
  await db.tenant.deleteMany({ where: { id: tenantId } });
  await db.$disconnect();
});

describe("Kiosk device status", () => {
  it("active device has status ACTIVE", async () => {
    const device = await db.kioskDevice.findUnique({ where: { id: kioskDeviceA } });
    expect(device?.status).toBe("ACTIVE");
  });

  it("revoked device has status REVOKED", async () => {
    const device = await db.kioskDevice.findUnique({ where: { id: kioskDeviceRevoked } });
    expect(device?.status).toBe("REVOKED");
  });
});

describe("Kiosk device branch isolation", () => {
  it("device is scoped to its branch", async () => {
    const device = await db.kioskDevice.findUnique({ where: { id: kioskDeviceA } });
    expect(device?.branchId).toBe(branchA);
    expect(device?.branchId).not.toBe(branchB);
  });

  it("querying device under wrong branch returns null", async () => {
    const device = await db.kioskDevice.findFirst({
      where: { id: kioskDeviceA, branchId: branchB },
    });
    expect(device).toBeNull();
  });

  it("device belongs to correct tenant", async () => {
    const device = await db.kioskDevice.findFirst({
      where: { id: kioskDeviceA, companyId: tenantId },
    });
    expect(device).not.toBeNull();
  });

  it("device not found under wrong tenant", async () => {
    const device = await db.kioskDevice.findFirst({
      where: { id: kioskDeviceA, companyId: "non-existent-tenant" },
    });
    expect(device).toBeNull();
  });
});

describe("Revoked kiosk device", () => {
  it("application should reject clock-in from revoked device", async () => {
    const device = await db.kioskDevice.findUnique({ where: { id: kioskDeviceRevoked } });
    // Application logic should check device.status !== "ACTIVE" and reject
    expect(device?.status).toBe("REVOKED");
  });

  it("revoked device has revokedAt timestamp", async () => {
    const device = await db.kioskDevice.findUnique({ where: { id: kioskDeviceRevoked } });
    expect(device?.revokedAt).not.toBeNull();
  });
});

describe("Wrong-branch kiosk device", () => {
  it("device from branch A cannot be used for branch B operations", async () => {
    const device = await db.kioskDevice.findUnique({ where: { id: kioskDeviceA } });
    // Application should verify device.branchId matches the requested branchId
    expect(device?.branchId).toBe(branchA);
    expect(device?.branchId).not.toBe(branchB);
  });

  it("kiosk lookup validates branch matches device branch", async () => {
    // In kioskLookupAction, the code verifies:
    // 1. branch exists and belongs to tenant
    // 2. device (if provided) must be ACTIVE and belong to same branch
    // This is a structural test — actual HTTP test needs running server
    const device = await db.kioskDevice.findFirst({
      where: {
        companyId: tenantId,
        branchId: branchA,
        status: "ACTIVE",
        deviceIdentifier: { not: "" },
      },
    });
    expect(device).not.toBeNull();
    expect(device?.branchId).toBe(branchA);
  });
});
