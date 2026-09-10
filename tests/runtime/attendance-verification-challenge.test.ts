import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  AttendanceVerificationChallengeError,
  consumeAttendanceVerificationChallenge,
  hashAttendanceVerificationChallenge,
  issueAttendanceVerificationChallenge,
  validateAttendanceVerificationChallenge,
} from "@/lib/attendance/verification-challenge";

const db = new PrismaClient();
const PASSWORD_HASH_FIXTURE = "$2b$10$runtimefixturehashnotusedforpasswordlogin000000000000000000";

let tenantId: string;
let planId: string;
let userId: string;
let employeeId: string;

beforeAll(async () => {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const plan = await db.plan.create({
    data: {
      slug: `verification-challenge-${unique}`,
      name: "Verification Challenge Runtime Plan",
      priceMonthly: 1,
      priceAnnual: 10,
      maxBranches: 2,
      maxEmployees: 10,
      maxManagers: 2,
      maxKiosks: 2,
      isActive: true,
    },
  });
  planId = plan.id;

  const tenant = await db.tenant.create({
    data: {
      name: "Verification Challenge Tenant",
      slug: `verification-challenge-tenant-${unique}`,
      ownerEmail: `owner-${unique}@verification.test`,
      ownerName: "Verification Owner",
      ownerPhone: "+201000000055",
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

  const employee = await db.employee.create({
    data: {
      companyId: tenantId,
      employeeCode: `VC-${unique}`,
      fullName: "Verification Employee",
      status: "ACTIVE",
    },
  });
  employeeId = employee.id;

  const user = await db.user.create({
    data: {
      companyId: tenantId,
      email: `employee-${unique}@verification.test`,
      passwordHash: PASSWORD_HASH_FIXTURE,
      name: "Verification Employee",
      role: "EMPLOYEE",
      status: "ACTIVE",
      employeeId,
    },
  });
  userId = user.id;
  await db.employee.update({ where: { id: employeeId }, data: { userId } });
});

afterAll(async () => {
  await db.attendanceVerificationChallenge.deleteMany({ where: { companyId: tenantId } });
  await db.user.deleteMany({ where: { companyId: tenantId } });
  await db.employee.deleteMany({ where: { companyId: tenantId } });
  await db.subscription.delete({ where: { tenantId } });
  await db.tenant.delete({ where: { id: tenantId } });
  await db.plan.delete({ where: { id: planId } });
  await db.$disconnect();
});

describe("attendance verification challenge", () => {
  it("stores only the challenge hash and binds validation to tenant, employee, user and provider", async () => {
    const issued = await issueAttendanceVerificationChallenge({
      companyId: tenantId,
      employeeId,
      userId,
      providerKey: "runtime-test-provider",
      capabilities: ["DEVICE_INTEGRITY", "FACE_MATCH"],
    });

    const stored = await db.attendanceVerificationChallenge.findUnique({ where: { id: issued.id } });
    expect(stored).toBeTruthy();
    expect(stored?.nonceHash).toBe(hashAttendanceVerificationChallenge(issued.challenge));
    expect(stored?.nonceHash).not.toBe(issued.challenge);
    expect(stored?.requestedCapabilities).toBe(JSON.stringify(["DEVICE_INTEGRITY", "FACE_MATCH"]));

    await expect(validateAttendanceVerificationChallenge({
      id: issued.id,
      challenge: issued.challenge,
      companyId: tenantId,
      employeeId,
      userId,
      providerKey: "runtime-test-provider",
    })).resolves.toMatchObject({ id: issued.id });

    await expect(validateAttendanceVerificationChallenge({
      id: issued.id,
      challenge: `${issued.challenge}x`,
      companyId: tenantId,
      employeeId,
      userId,
      providerKey: "runtime-test-provider",
    })).rejects.toMatchObject({ code: "CHALLENGE_INVALID" });

    await expect(validateAttendanceVerificationChallenge({
      id: issued.id,
      challenge: issued.challenge,
      companyId: tenantId,
      employeeId,
      userId: "another-user",
      providerKey: "runtime-test-provider",
    })).rejects.toMatchObject({ code: "CHALLENGE_NOT_FOUND" });

    await expect(validateAttendanceVerificationChallenge({
      id: issued.id,
      challenge: issued.challenge,
      companyId: tenantId,
      employeeId,
      userId,
      providerKey: "different-provider",
    })).rejects.toMatchObject({ code: "CHALLENGE_PROVIDER_MISMATCH" });
  });

  it("allows exactly one atomic consume and rejects replay", async () => {
    const issued = await issueAttendanceVerificationChallenge({
      companyId: tenantId,
      employeeId,
      userId,
      providerKey: "runtime-test-provider",
      capabilities: ["LIVENESS"],
    });

    await db.$transaction(async (tx) => {
      await consumeAttendanceVerificationChallenge(tx, {
        id: issued.id,
        companyId: tenantId,
        employeeId,
        userId,
      });
    });

    const consumed = await db.attendanceVerificationChallenge.findUnique({ where: { id: issued.id } });
    expect(consumed?.consumedAt).toBeInstanceOf(Date);

    await expect(db.$transaction(async (tx) => {
      await consumeAttendanceVerificationChallenge(tx, {
        id: issued.id,
        companyId: tenantId,
        employeeId,
        userId,
      });
    })).rejects.toBeInstanceOf(AttendanceVerificationChallengeError);

    await expect(validateAttendanceVerificationChallenge({
      id: issued.id,
      challenge: issued.challenge,
      companyId: tenantId,
      employeeId,
      userId,
      providerKey: "runtime-test-provider",
    })).rejects.toMatchObject({ code: "CHALLENGE_ALREADY_USED" });
  });
});
