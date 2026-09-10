"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { evaluatePermission } from "@/lib/auth/authorization";
import {
  BiometricIdentityError,
  requestBiometricEnrollment,
  revokeBiometricEnrollment,
} from "@/lib/attendance/biometric-identity";

const EmployeeSchema = z.object({ employeeId: z.string().min(1).max(128) });
const RevokeSchema = EmployeeSchema.extend({ reason: z.string().trim().min(3).max(500) });

async function authorizeEmployeeBiometrics(employeeId: string) {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) throw new Error("FORBIDDEN");

  const employee = await db.employee.findFirst({
    where: { id: employeeId, companyId: session.tenantId, deletedAt: null },
    select: {
      id: true,
      branchId: true,
      departmentId: true,
      user: { select: { id: true, status: true, deletedAt: true } },
    },
  });
  if (!employee) throw new Error("EMPLOYEE_NOT_FOUND");

  const decision = await evaluatePermission({
    companyId: session.tenantId,
    userId: session.sub,
    legacyRole: session.role,
    permission: "biometrics.manage",
    scope: {
      branchId: employee.branchId,
      departmentId: employee.departmentId,
      targetUserId: employee.user?.id ?? null,
    },
  });
  if (!decision.allowed) throw new Error("PERMISSION_DENIED:biometrics.manage");

  return { session, employee };
}

export async function requestEmployeeBiometricEnrollmentAction(formData: FormData) {
  const parsed = EmployeeSchema.safeParse({ employeeId: formData.get("employeeId") });
  if (!parsed.success) return { ok: false, error: "INVALID_REQUEST" };

  try {
    const { session, employee } = await authorizeEmployeeBiometrics(parsed.data.employeeId);
    if (!employee.user || employee.user.status !== "ACTIVE" || employee.user.deletedAt) {
      return { ok: false, error: "ACTIVE_USER_REQUIRED" };
    }

    await requestBiometricEnrollment({
      companyId: session.tenantId!,
      employeeId: employee.id,
      actorUserId: session.sub,
    });
    revalidatePath(`/employees/${employee.id}`);
    revalidatePath("/employees");
    return { ok: true };
  } catch (error) {
    if (error instanceof BiometricIdentityError) return { ok: false, error: error.code };
    const message = error instanceof Error ? error.message : "BIOMETRIC_ENROLLMENT_REQUEST_FAILED";
    return { ok: false, error: message };
  }
}

export async function revokeEmployeeBiometricEnrollmentAction(formData: FormData) {
  const parsed = RevokeSchema.safeParse({
    employeeId: formData.get("employeeId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, error: "INVALID_REQUEST" };

  try {
    const { session, employee } = await authorizeEmployeeBiometrics(parsed.data.employeeId);
    await revokeBiometricEnrollment({
      companyId: session.tenantId!,
      employeeId: employee.id,
      actorUserId: session.sub,
      reason: parsed.data.reason,
    });
    revalidatePath(`/employees/${employee.id}`);
    revalidatePath("/employees");
    return { ok: true };
  } catch (error) {
    if (error instanceof BiometricIdentityError) return { ok: false, error: error.code };
    const message = error instanceof Error ? error.message : "BIOMETRIC_REVOKE_FAILED";
    return { ok: false, error: message };
  }
}
