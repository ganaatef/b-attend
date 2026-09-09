/**
 * B-Attend kiosk authentication core.
 *
 * Server-side enforcement for kiosk mode:
 *   1. Device trust — every KIOSK request must present a registered ACTIVE
 *      device (deviceIdentifier) PLUS a high-entropy device secret that is
 *      verified against KioskDevice.secretHash. The raw secret is generated at
 *      activation/rotation, returned exactly once, and never stored or logged.
 *   2. Credential gate — employees are identified ONLY by employeeCode. The
 *      PIN is NEVER queried from the database and is verified with a
 *      constant-time bcrypt.compare() against Employee.pinHash.
 *   3. Brute-force protection — failed PIN attempts are recorded on the
 *      KioskDevice row in the database (persistent/distributed across
 *      serverless instances, not in-memory). Reaching the threshold locks the
 *      device until the window expires.
 *
 * All device failures collapse into ONE generic error so a client cannot
 * enumerate devices, branches, tenants, or employees.
 * Audit events never include the PIN or the device secret.
 */

import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { logTenantEvent } from "@/lib/auth/audit";

export const KIOSK_DEVICE_ERROR = "Kiosk device is not authorized for this branch.";
export const KIOSK_CREDENTIALS_ERROR = "Invalid employee code or PIN.";

export const MAX_FAILED_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_MS = 60_000;

/** High-entropy device secret: 32 random bytes, hex-encoded (64 chars). */
export function generateDeviceSecret(): string {
  return randomBytes(32).toString("hex");
}

export async function hashDeviceSecret(secret: string): Promise<string> {
  return hashPassword(secret);
}

export async function verifyDeviceSecret(secret: string, secretHash: string): Promise<boolean> {
  return verifyPassword(secret, secretHash);
}

export type KioskDeviceResult =
  | { ok: true; device: { id: string; branchId: string } }
  | { ok: false; code: "MISSING" | "REJECTED" };

/**
 * Device trust gate. Verification order:
 *   1. device exists
 *   2. tenant matches
 *   3. branch matches
 *   4. status == ACTIVE
 *   5. secret verifies against secretHash
 *   6. not revoked (revokedAt is set when REVOKED)
 *   7. update lastSeenAt (best effort — never fails the request)
 *
 * Every failure returns the same generic "MISSING"/"REJECTED" codes.
 */
export async function validateKioskDevice(input: {
  tenantId: string;
  branchId: string;
  deviceIdentifier?: string;
  deviceSecret?: string;
}): Promise<KioskDeviceResult> {
  if (!input.deviceIdentifier || !input.deviceSecret) return { ok: false, code: "MISSING" };

  const device = await db.kioskDevice.findUnique({
    where: { deviceIdentifier: input.deviceIdentifier },
  });
  if (!device) return { ok: false, code: "REJECTED" };
  if (device.companyId !== input.tenantId) return { ok: false, code: "REJECTED" };
  if (device.branchId !== input.branchId) return { ok: false, code: "REJECTED" };
  if (device.status !== "ACTIVE") return { ok: false, code: "REJECTED" };
  if (device.revokedAt) return { ok: false, code: "REJECTED" };

  const secretOk = await verifyDeviceSecret(input.deviceSecret, device.secretHash);
  if (!secretOk) return { ok: false, code: "REJECTED" };

  await db.kioskDevice
    .update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })
    .catch(() => null);

  return { ok: true, device: { id: device.id, branchId: device.branchId } };
}

/**
 * DB-backed lockout state. Persisted on the KioskDevice row so the limiter
 * works across serverless instances (distributed control), unlike an in-memory
 * map which would reset per instance / cold start.
 */
export async function isDeviceLocked(deviceId: string): Promise<boolean> {
  const d = await db.kioskDevice.findUnique({
    where: { id: deviceId },
    select: { lockedUntil: true },
  });
  return !!d?.lockedUntil && d.lockedUntil.getTime() > Date.now();
}

/** Record one failed PIN attempt; locks the device once the threshold is hit. */
export async function recordFailedPinAttempt(deviceId: string): Promise<void> {
  const d = await db.kioskDevice.findUnique({
    where: { id: deviceId },
    select: { failedPinAttempts: true, lockedUntil: true },
  });
  if (!d) return;
  if (d.lockedUntil && d.lockedUntil.getTime() > Date.now()) return;

  const next = d.failedPinAttempts + 1;
  await db.kioskDevice.update({
    where: { id: deviceId },
    data: {
      failedPinAttempts: next,
      lockedUntil: next >= MAX_FAILED_PIN_ATTEMPTS ? new Date(Date.now() + PIN_LOCKOUT_MS) : null,
    },
  });
}

export async function clearFailedPinAttempts(deviceId: string): Promise<void> {
  await db.kioskDevice.update({
    where: { id: deviceId },
    data: { failedPinAttempts: 0, lockedUntil: null },
  });
}

export type KioskVerifyOutcome =
  | {
      ok: true;
      deviceId: string;
      employeeId: string;
      employeeCode: string;
      fullName: string;
    }
  | { ok: false; code: "MISSING_DEVICE" | "UNKNOWN_DEVICE" | "INVALID_CREDENTIALS" | "RATE_LIMITED"; error: string };

/**
 * Full kiosk credential verification.
 *
 * - Validates device trust (identifier + secret).
 * - Identifies the employee by employeeCode only (never by plaintext PIN).
 * - Requires Employee.pinHash to exist.
 * - Verifies the PIN with bcrypt.compare().
 * - Records failed attempts on the KioskDevice row and locks after the limit.
 * - Returns only generic errors — no PIN, no employee enumeration.
 */
export async function verifyKioskCredentials(params: {
  tenantId: string;
  branchId: string;
  deviceIdentifier: string;
  deviceSecret: string;
  code: string;
  pin: string;
}): Promise<KioskVerifyOutcome> {
  const device = await validateKioskDevice({
    tenantId: params.tenantId,
    branchId: params.branchId,
    deviceIdentifier: params.deviceIdentifier,
    deviceSecret: params.deviceSecret,
  });

  if (!device.ok) {
    await logTenantEvent({
      companyId: params.tenantId,
      actorEmail: "kiosk",
      action: "KIOSK_DEVICE_REJECTED",
      entityType: "KioskDevice",
      reason: device.code === "MISSING" ? "Device identifier or secret missing" : "Device rejected",
      afterData: { branchId: params.branchId },
    });
    return {
      ok: false,
      code: device.code === "MISSING" ? "MISSING_DEVICE" : "UNKNOWN_DEVICE",
      error: KIOSK_DEVICE_ERROR,
    };
  }

  if (await isDeviceLocked(device.device.id)) {
    await logTenantEvent({
      companyId: params.tenantId,
      actorEmail: "kiosk",
      action: "KIOSK_PIN_RATE_LIMITED",
      entityType: "KioskDevice",
      entityId: device.device.id,
      reason: "Failed PIN attempts exceeded",
    });
    return { ok: false, code: "RATE_LIMITED", error: KIOSK_CREDENTIALS_ERROR };
  }

  const employee = await db.employee.findFirst({
    where: {
      companyId: params.tenantId,
      employeeCode: params.code,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true, employeeCode: true, fullName: true, pinHash: true },
  });

  if (!employee || !employee.pinHash) {
    await recordFailedPinAttempt(device.device.id);
    await logTenantEvent({
      companyId: params.tenantId,
      actorEmail: "kiosk",
      action: "KIOSK_PIN_FAILED",
      entityType: "Employee",
      reason: "Unknown employee code or missing PIN hash",
    });
    return { ok: false, code: "INVALID_CREDENTIALS", error: KIOSK_CREDENTIALS_ERROR };
  }

  const pinOk = await verifyPassword(params.pin, employee.pinHash);
  if (!pinOk) {
    await recordFailedPinAttempt(device.device.id);
    await logTenantEvent({
      companyId: params.tenantId,
      actorEmail: "kiosk",
      action: "KIOSK_PIN_FAILED",
      entityType: "Employee",
      entityId: employee.id,
      reason: "PIN mismatch",
    });
    return { ok: false, code: "INVALID_CREDENTIALS", error: KIOSK_CREDENTIALS_ERROR };
  }

  await clearFailedPinAttempts(device.device.id);
  return {
    ok: true,
    deviceId: device.device.id,
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
  };
}

/**
 * Provisioning — generate a device secret, store ONLY its hash, and bind the
 * device to a tenant + branch. The raw secret is returned exactly once.
 */
export async function activateKioskDevice(params: {
  tenantId: string;
  branchId: string;
  name: string;
  deviceIdentifier?: string;
  createdById?: string;
}): Promise<{ deviceId: string; deviceIdentifier: string; deviceSecret: string }> {
  const deviceSecret = generateDeviceSecret();
  const secretHash = await hashDeviceSecret(deviceSecret);
  const deviceIdentifier = params.deviceIdentifier ?? `kiosk-${randomBytes(6).toString("hex")}`;
  const device = await db.kioskDevice.create({
    data: {
      companyId: params.tenantId,
      branchId: params.branchId,
      name: params.name,
      deviceIdentifier,
      secretHash,
      status: "ACTIVE",
      activatedAt: new Date(),
      createdById: params.createdById,
    },
    select: { id: true, deviceIdentifier: true },
  });
  return { deviceId: device.id, deviceIdentifier: device.deviceIdentifier, deviceSecret };
}

/**
 * Rotation — replace secretHash with a freshly generated secret hash. The old
 * secret stops verifying immediately (reject old secret after rotation). The
 * new raw secret is returned exactly once.
 */
export async function rotateKioskDeviceSecret(params: {
  tenantId: string;
  deviceId: string;
}): Promise<{ deviceIdentifier: string; deviceSecret: string }> {
  const device = await db.kioskDevice.findFirst({
    where: { id: params.deviceId, companyId: params.tenantId },
  });
  if (!device) throw new Error("Kiosk device not found");

  const deviceSecret = generateDeviceSecret();
  const secretHash = await hashDeviceSecret(deviceSecret);
  await db.kioskDevice.update({
    where: { id: device.id },
    data: { secretHash, rotatedAt: new Date() },
  });

  return { deviceIdentifier: device.deviceIdentifier, deviceSecret };
}

/** Revocation — marks the device REVOKED. Revoked devices are rejected by the gate. */
export async function revokeKioskDevice(params: {
  tenantId: string;
  deviceId: string;
}): Promise<void> {
  const res = await db.kioskDevice.updateMany({
    where: { id: params.deviceId, companyId: params.tenantId },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  if (res.count === 0) throw new Error("Kiosk device not found");
}
