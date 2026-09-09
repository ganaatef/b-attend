/**
 * Behavioral tests — Kiosk device trust (identifier + secret), PIN auth,
 * and DB-backed lockout.
 *
 * These tests exercise the real `kioskLookupAction` handler end-to-end
 * (schema parsing → session gate → device secret verify → bcrypt PIN verify →
 * data fetch) with the database and session mocked. They do NOT inspect
 * source patterns as evidence.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";

const dbMock = vi.hoisted(() => ({
  branch: { findFirst: vi.fn() },
  kioskDevice: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  employee: { findFirst: vi.fn(), findUnique: vi.fn() },
  schedule: { findUnique: vi.fn() },
  punch: { findFirst: vi.fn() },
  auditLog: { create: vi.fn() },
  platformAuditLog: { create: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getSession } from "@/lib/auth/session";
import { kioskLookupAction } from "@/app/(tenant)/clock/actions";
import {
  activateKioskDevice,
  rotateKioskDeviceSecret,
  revokeKioskDevice,
  validateKioskDevice,
  verifyDeviceSecret,
  generateDeviceSecret,
} from "@/lib/kiosk/kiosk-auth";

const TENANT_ID = "tenant-1";
const BRANCH_A = "branch-a";
const BRANCH_B = "branch-b";
const DEVICE_ACTIVE = "kiosk-active-123";
const DEVICE_REVOKED = "kiosk-revoked-123";
const DEVICE_OTHER_TENANT = "kiosk-other-tenant-123";
const DEVICE_OTHER_BRANCH = "kiosk-other-branch-123";
const DEVICE_SECRET = "device-secret-abcdef0123456789";
const WRONG_SECRET = "device-secret-wrong-0000000000";

let pinHash: string;
let deviceSecretHash: string;

const session = {
  sub: "user-manager-1",
  kind: "tenant",
  role: "BRANCH_MANAGER",
  tenantId: TENANT_ID,
  name: "Manager",
  email: "manager@test.com",
} as any;

function makeForm(overrides: Record<string, string>) {
  const fd = new FormData();
  fd.set("branchId", BRANCH_A);
  fd.set("code", "EMP001");
  fd.set("pin", "1234");
  fd.set("deviceIdentifier", DEVICE_ACTIVE);
  fd.set("deviceSecret", DEVICE_SECRET);
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

let deviceState: Record<string, any>;

function defaultDeviceState(): Record<string, any> {
  return {
    id: "device-id-active",
    companyId: TENANT_ID,
    branchId: BRANCH_A,
    status: "ACTIVE",
    deviceIdentifier: DEVICE_ACTIVE,
    secretHash: deviceSecretHash,
    revokedAt: null,
    rotatedAt: null,
    lastSeenAt: null,
    failedPinAttempts: 0,
    lockedUntil: null,
  };
}

const employeeRecord = {
  id: "emp-1",
  employeeCode: "EMP001",
  fullName: "John Doe",
  jobTitle: "Waiter",
  branch: { name: "Branch A" },
  defaultShiftPolicy: null,
};

beforeAll(async () => {
  pinHash = await bcrypt.hash("1234", 10);
  deviceSecretHash = await bcrypt.hash(DEVICE_SECRET, 10);
});

beforeEach(() => {
  vi.clearAllMocks();
  deviceState = defaultDeviceState();

  vi.mocked(getSession).mockResolvedValue(session);

  dbMock.kioskDevice.findUnique.mockImplementation(async ({ where, select }: any) => {
    const matchesId = where.id !== undefined ? where.id === deviceState.id : where.deviceIdentifier === deviceState.deviceIdentifier;
    if (!matchesId) return null;
    if (select?.failedPinAttempts) {
      return { failedPinAttempts: deviceState.failedPinAttempts, lockedUntil: deviceState.lockedUntil };
    }
    if (select?.lockedUntil) return { lockedUntil: deviceState.lockedUntil };
    return { ...deviceState };
  });
  dbMock.kioskDevice.update.mockImplementation(async ({ where, data }: any) => {
    if (data && typeof data.failedPinAttempts !== "undefined") {
      deviceState.failedPinAttempts = data.failedPinAttempts;
      deviceState.lockedUntil = data.lockedUntil;
    }
    if (data && data.secretHash) {
      deviceState.secretHash = data.secretHash;
      deviceState.rotatedAt = data.rotatedAt;
    }
    if (data && data.lastSeenAt) deviceState.lastSeenAt = data.lastSeenAt;
    return { ...deviceState };
  });
  dbMock.kioskDevice.updateMany.mockResolvedValue({ count: 1 });
  dbMock.kioskDevice.create.mockImplementation(async ({ data }: any) => ({ id: "device-created", ...data }));
  dbMock.kioskDevice.findFirst.mockImplementation(async () => ({ ...deviceState }));

  dbMock.branch.findFirst.mockResolvedValue({ id: BRANCH_A, companyId: TENANT_ID });
  dbMock.employee.findFirst.mockResolvedValue({
    id: "emp-1",
    employeeCode: "EMP001",
    fullName: "John Doe",
    pinHash,
  });
  dbMock.employee.findUnique.mockResolvedValue(employeeRecord);
  dbMock.schedule.findUnique.mockResolvedValue(null);
  dbMock.punch.findFirst.mockResolvedValue(null);
});

describe("kioskLookupAction — device trust gate (identifier + secret)", () => {
  it("succeeds with an ACTIVE device bound to the tenant and branch and a valid secret", async () => {
    const r = await kioskLookupAction({}, makeForm({}));

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.employee.employeeCode).toBe("EMP001");
      expect(r.employee.id).toBe("emp-1");
    }
    // Successful requests touch lastSeenAt on the device row.
    expect(dbMock.kioskDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastSeenAt: expect.any(Date) }) })
    );
  });

  it("rejects a missing device identifier", async () => {
    const r = await kioskLookupAction({}, makeForm({ deviceIdentifier: "" }));

    expect(r.ok).toBe(false);
    expect(dbMock.employee.findFirst).not.toHaveBeenCalled();
    expect(dbMock.schedule.findUnique).not.toHaveBeenCalled();
    expect(dbMock.punch.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a missing device secret", async () => {
    const r = await kioskLookupAction({}, makeForm({ deviceSecret: "" }));

    expect(r.ok).toBe(false);
    expect(dbMock.employee.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an unknown (unregistered) device", async () => {
    dbMock.kioskDevice.findUnique.mockResolvedValue(null);

    const r = await kioskLookupAction({}, makeForm({}));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("not authorized");
    expect(dbMock.employee.findFirst).not.toHaveBeenCalled();
    expect(dbMock.schedule.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a wrong device secret with the generic error", async () => {
    const r = await kioskLookupAction({}, makeForm({ deviceSecret: WRONG_SECRET }));

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("not authorized");
      expect(r.error).not.toContain(WRONG_SECRET);
    }
    expect(dbMock.employee.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a REVOKED device", async () => {
    dbMock.kioskDevice.findUnique.mockResolvedValue({
      ...defaultDeviceState(),
      id: "device-id-revoked",
      deviceIdentifier: DEVICE_REVOKED,
      status: "REVOKED",
      revokedAt: new Date(),
    });

    const r = await kioskLookupAction({}, makeForm({ deviceIdentifier: DEVICE_REVOKED }));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("not authorized");
    expect(dbMock.employee.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a device belonging to a different branch", async () => {
    dbMock.kioskDevice.findUnique.mockResolvedValue({
      ...defaultDeviceState(),
      id: "device-id-other-branch",
      deviceIdentifier: DEVICE_OTHER_BRANCH,
      branchId: BRANCH_B,
    });

    const r = await kioskLookupAction({}, makeForm({ deviceIdentifier: DEVICE_OTHER_BRANCH }));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("not authorized");
    expect(dbMock.employee.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a device belonging to a different tenant", async () => {
    dbMock.kioskDevice.findUnique.mockResolvedValue({
      ...defaultDeviceState(),
      id: "device-id-other-tenant",
      deviceIdentifier: DEVICE_OTHER_TENANT,
      companyId: "tenant-other",
    });

    const r = await kioskLookupAction({}, makeForm({ deviceIdentifier: DEVICE_OTHER_TENANT }));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("not authorized");
    expect(dbMock.employee.findFirst).not.toHaveBeenCalled();
  });

  it("records a non-sensitive audit event for device rejection", async () => {
    dbMock.kioskDevice.findUnique.mockResolvedValue(null);

    const r = await kioskLookupAction({}, makeForm({}));
    expect(r.ok).toBe(false);

    expect(dbMock.auditLog.create).toHaveBeenCalled();
    const auditPayload = dbMock.auditLog.create.mock.calls[0][0].data;
    expect(auditPayload.action).toBe("KIOSK_DEVICE_REJECTED");
    expect(JSON.stringify(auditPayload)).not.toMatch(/1234/);
    expect(JSON.stringify(auditPayload)).not.toContain(DEVICE_SECRET);
  });
});

describe("Kiosk device credential lifecycle", () => {
  it("activation returns a high-entropy secret exactly once and stores only its hash", async () => {
    const act = await activateKioskDevice({
      tenantId: TENANT_ID,
      branchId: BRANCH_A,
      name: "Reception Kiosk",
      deviceIdentifier: DEVICE_ACTIVE,
    });

    // 64 hex chars = 32 random bytes.
    expect(act.deviceSecret).toMatch(/^[0-9a-f]{64}$/);

    expect(dbMock.kioskDevice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: TENANT_ID,
          branchId: BRANCH_A,
          status: "ACTIVE",
          activatedAt: expect.any(Date),
        }),
      })
    );
    const createdData = dbMock.kioskDevice.create.mock.calls[0][0].data;
    // Raw secret is NOT stored — only the bcrypt hash.
    expect(createdData.secretHash).not.toContain(act.deviceSecret);
    expect(createdData.secretHash).toMatch(/^\$2[aby]\$/);
    expect(await verifyDeviceSecret(act.deviceSecret, createdData.secretHash)).toBe(true);
  });

  it("a generated secret is high-entropy and unique", () => {
    const s1 = generateDeviceSecret();
    const s2 = generateDeviceSecret();
    expect(s1).toMatch(/^[0-9a-f]{64}$/);
    expect(s1).not.toBe(s2);
  });

  it("rotation returns a new secret and the old secret no longer verifies", async () => {
    const created = await dbMock.kioskDevice.create({
      data: {
        companyId: TENANT_ID,
        branchId: BRANCH_A,
        name: "Reception Kiosk",
        deviceIdentifier: DEVICE_ACTIVE,
        secretHash: await bcrypt.hash("old-secret", 10),
        status: "ACTIVE",
      },
    });
    deviceState.id = created.id;
    deviceState.deviceIdentifier = DEVICE_ACTIVE;

    const rotated = await rotateKioskDeviceSecret({ tenantId: TENANT_ID, deviceId: created.id });

    expect(rotated.deviceSecret).toMatch(/^[0-9a-f]{64}$/);
    expect(rotated.deviceSecret).not.toBe("old-secret");
    expect(deviceState.rotatedAt).not.toBeNull();

    // Old secret rejected, new secret accepted.
    expect(await verifyDeviceSecret("old-secret", deviceState.secretHash)).toBe(false);
    expect(await verifyDeviceSecret(rotated.deviceSecret, deviceState.secretHash)).toBe(true);
  });

  it("revocation marks the device REVOKED with a timestamp", async () => {
    await revokeKioskDevice({ tenantId: TENANT_ID, deviceId: "device-id-active" });

    expect(dbMock.kioskDevice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "device-id-active", companyId: TENANT_ID },
        data: expect.objectContaining({ status: "REVOKED", revokedAt: expect.any(Date) }),
      })
    );
  });

  it("validateKioskDevice returns the generic rejection for every invalid credential", async () => {
    for (const attempt of [
      { tenantId: TENANT_ID, branchId: BRANCH_A, deviceIdentifier: "", deviceSecret: DEVICE_SECRET },
      { tenantId: TENANT_ID, branchId: BRANCH_A, deviceIdentifier: DEVICE_ACTIVE, deviceSecret: "" },
      { tenantId: TENANT_ID, branchId: BRANCH_A, deviceIdentifier: DEVICE_ACTIVE, deviceSecret: WRONG_SECRET },
      { tenantId: "tenant-other", branchId: BRANCH_A, deviceIdentifier: DEVICE_ACTIVE, deviceSecret: DEVICE_SECRET },
      { tenantId: TENANT_ID, branchId: BRANCH_B, deviceIdentifier: DEVICE_ACTIVE, deviceSecret: DEVICE_SECRET },
    ]) {
      const r = await validateKioskDevice(attempt);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(["MISSING", "REJECTED"]).toContain(r.code);
      }
    }
  });
});

describe("kioskLookupAction — PIN verification", () => {
  it("looks employees up by employeeCode only (never by plaintext PIN)", async () => {
    await kioskLookupAction({}, makeForm({}));

    expect(dbMock.employee.findFirst).toHaveBeenCalled();
    const where = dbMock.employee.findFirst.mock.calls[0][0].where;
    expect(where.employeeCode).toBe("EMP001");
    expect(where).not.toHaveProperty("OR");
    expect(where).not.toHaveProperty("pinCode");
  });

  it("rejects a wrong PIN with a generic error", async () => {
    const r = await kioskLookupAction({}, makeForm({ pin: "9999" }));

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).not.toContain("9999");
      expect(r.error).not.toContain("EMP001");
    }
    expect(dbMock.employee.findUnique).not.toHaveBeenCalled();
    expect(dbMock.schedule.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an employee whose pinHash is missing", async () => {
    dbMock.employee.findFirst.mockResolvedValue({
      id: "emp-1",
      employeeCode: "EMP001",
      fullName: "John Doe",
      pinHash: null,
    });

    const r = await kioskLookupAction({}, makeForm({}));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Invalid employee code or PIN");
  });

  it("rejects an unknown employee code with a generic error", async () => {
    dbMock.employee.findFirst.mockResolvedValue(null);

    const r = await kioskLookupAction({}, makeForm({}));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Invalid employee code or PIN");
    expect(dbMock.employee.findUnique).not.toHaveBeenCalled();
  });
});

describe("kioskLookupAction — DB-backed lockout after repeated failures", () => {
  it("locks the device after 5 failed PIN attempts and rejects even a correct PIN", async () => {
    for (let i = 0; i < 5; i++) {
      const r = await kioskLookupAction({}, makeForm({ pin: "9999" }));
      expect(r.ok).toBe(false);
    }

    expect(deviceState.failedPinAttempts).toBe(5);
    expect(deviceState.lockedUntil).toBeInstanceOf(Date);
    expect((deviceState.lockedUntil as Date).getTime()).toBeGreaterThan(Date.now());

    // Even a correct PIN is rejected while the device is locked.
    const r = await kioskLookupAction({}, makeForm({ pin: "1234" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Invalid employee code or PIN");
    expect(dbMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "KIOSK_PIN_RATE_LIMITED" }) })
    );
  });

  it("resets the failed-attempt counter on success", async () => {
    for (let i = 0; i < 4; i++) {
      await kioskLookupAction({}, makeForm({ pin: "9999" }));
    }
    expect(deviceState.failedPinAttempts).toBe(4);

    const success = await kioskLookupAction({}, makeForm({ pin: "1234" }));
    expect(success.ok).toBe(true);
    expect(deviceState.failedPinAttempts).toBe(0);
    expect(deviceState.lockedUntil).toBeNull();

    const next = await kioskLookupAction({}, makeForm({ pin: "1234" }));
    expect(next.ok).toBe(true);
  });
});

describe("kioskLookupAction — no secret leakage", () => {
  it("does not leak PIN or device secret in response data", async () => {
    const r = await kioskLookupAction({}, makeForm({}));
    expect(JSON.stringify(r)).not.toContain("1234");
    expect(JSON.stringify(r)).not.toContain(DEVICE_SECRET);
    expect(JSON.stringify(r)).not.toContain("deviceSecret");
  });
});
