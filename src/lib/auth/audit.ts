/**
 * B-Attend audit log helper.
 *
 * Writes to PlatformAuditLog (for super admin actions) or AuditLog (tenant-scoped).
 * All writes are best-effort — failures are logged but never block the calling operation.
 */

import { db } from "@/lib/db";

function redactSensitiveData(data: any): any {
  if (!data) return data;
  const redacted = { ...data };
  const sensitiveKeys = ["passwordHash", "password", "pinCode", "pinHash", "nationalId", "bankAccount", "secretHash"];
  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      redacted[key] = "[REDACTED]";
    }
  }
  return redacted;
}

export async function logPlatformEvent(params: {
  actorId?: string;
  actorEmail: string;
  action: string;
  entityType?: string;
  entityId?: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  beforeData?: unknown;
  afterData?: unknown;
}): Promise<void> {
  try {
    await db.platformAuditLog.create({
      data: {
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        reason: params.reason,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        beforeData: params.beforeData ? JSON.stringify(redactSensitiveData(params.beforeData)) : null,
        afterData: params.afterData ? JSON.stringify(redactSensitiveData(params.afterData)) : null,
      },
    });
  } catch (err) {
    console.error("[audit] Failed to log platform event:", err);
  }
}

export async function logTenantEvent(params: {
  companyId: string;
  actorId?: string;
  actorEmail: string;
  action: string;
  entityType?: string;
  entityId?: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  beforeData?: unknown;
  afterData?: unknown;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        companyId: params.companyId,
        actorId: params.actorId,
        actorEmail: params.actorEmail,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        reason: params.reason,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        beforeData: params.beforeData ? JSON.stringify(redactSensitiveData(params.beforeData)) : null,
        afterData: params.afterData ? JSON.stringify(redactSensitiveData(params.afterData)) : null,
      },
    });
  } catch (err) {
    console.error("[audit] Failed to log tenant event:", err);
  }
}
