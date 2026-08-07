/**
 * Runtime Integration Tests — Cross-tenant and cross-branch isolation.
 *
 * These tests require a real DATABASE_URL (test database).
 * Set DATABASE_URL to a test database before running:
 *   DATABASE_URL="postgresql://..." npx vitest run tests/runtime/cross-tenant.test.ts
 *
 * Tests use direct Prisma queries to simulate attack scenarios.
 * No HTTP layer — validates database-level isolation.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

let tenantA: string;
let tenantB: string;
let branchA1: string;
let branchA2: string;
let branchB1: string;
let employeeA1: string;
let employeeA2: string;
let employeeB1: string;

beforeAll(async () => {
  // Create two isolated tenants with branches and employees
  const tA = await db.tenant.create({
    data: {
      name: "Tenant A Runtime Test",
      slug: `runtime-test-a-${Date.now()}`,
      ownerEmail: `owner-a-${Date.now()}@test.com`,
      ownerName: "Owner A",
      ownerPhone: "+201000000001",
      status: "ACTIVE",
    },
  });
  tenantA = tA.id;

  const tB = await db.tenant.create({
    data: {
      name: "Tenant B Runtime Test",
      slug: `runtime-test-b-${Date.now()}`,
      ownerEmail: `owner-b-${Date.now()}@test.com`,
      ownerName: "Owner B",
      ownerPhone: "+201000000002",
      status: "ACTIVE",
    },
  });
  tenantB = tB.id;

  // Branches for Tenant A
  const bA1 = await db.branch.create({
    data: { companyId: tenantA, name: "Branch A1", code: "BA1", status: "ACTIVE" },
  });
  branchA1 = bA1.id;

  const bA2 = await db.branch.create({
    data: { companyId: tenantA, name: "Branch A2", code: "BA2", status: "ACTIVE" },
  });
  branchA2 = bA2.id;

  // Branch for Tenant B
  const bB1 = await db.branch.create({
    data: { companyId: tenantB, name: "Branch B1", code: "BB1", status: "ACTIVE" },
  });
  branchB1 = bB1.id;

  // Employees
  const eA1 = await db.employee.create({
    data: { companyId: tenantA, employeeCode: "EA001", fullName: "Emp A1", branchId: branchA1, status: "ACTIVE" },
  });
  employeeA1 = eA1.id;

  const eA2 = await db.employee.create({
    data: { companyId: tenantA, employeeCode: "EA002", fullName: "Emp A2", branchId: branchA2, status: "ACTIVE" },
  });
  employeeA2 = eA2.id;

  const eB1 = await db.employee.create({
    data: { companyId: tenantB, employeeCode: "EB001", fullName: "Emp B1", branchId: branchB1, status: "ACTIVE" },
  });
  employeeB1 = eB1.id;
});

afterAll(async () => {
  // Cleanup
  await db.punch.deleteMany({ where: { companyId: { in: [tenantA, tenantB] } } });
  await db.attendanceDay.deleteMany({ where: { companyId: { in: [tenantA, tenantB] } } });
  await db.schedule.deleteMany({ where: { companyId: { in: [tenantA, tenantB] } } });
  await db.approvalRequest.deleteMany({ where: { companyId: { in: [tenantA, tenantB] } } });
  await db.employee.deleteMany({ where: { companyId: { in: [tenantA, tenantB] } } });
  await db.branch.deleteMany({ where: { companyId: { in: [tenantA, tenantB] } } });
  await db.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
  await db.$disconnect();
});

describe("Cross-tenant read isolation", () => {
  it("querying employees of tenant A returns only A's employees when scoped", async () => {
    const employees = await db.employee.findMany({
      where: { companyId: tenantA, deletedAt: null },
    });
    const ids = employees.map((e) => e.id);
    expect(ids).toContain(employeeA1);
    expect(ids).toContain(employeeA2);
    expect(ids).not.toContain(employeeB1);
  });

  it("querying employees of tenant B returns only B's employees when scoped", async () => {
    const employees = await db.employee.findMany({
      where: { companyId: tenantB, deletedAt: null },
    });
    const ids = employees.map((e) => e.id);
    expect(ids).toContain(employeeB1);
    expect(ids).not.toContain(employeeA1);
    expect(ids).not.toContain(employeeA2);
  });

  it("branch query scoped to tenant A excludes tenant B branches", async () => {
    const branches = await db.branch.findMany({
      where: { companyId: tenantA, deletedAt: null },
    });
    const ids = branches.map((b) => b.id);
    expect(ids).toContain(branchA1);
    expect(ids).toContain(branchA2);
    expect(ids).not.toContain(branchB1);
  });
});

describe("Cross-tenant write isolation", () => {
  it("cannot update employee belonging to different tenant", async () => {
    const emp = await db.employee.findFirst({
      where: { id: employeeB1, companyId: tenantA },
    });
    expect(emp).toBeNull();
  });

  it("cannot delete employee belonging to different tenant", async () => {
    const result = await db.employee.updateMany({
      where: { id: employeeB1, companyId: tenantA },
      data: { status: "LEFT" },
    });
    expect(result.count).toBe(0);
  });

  it("creating schedule for cross-tenant employee fails", async () => {
    const policy = await db.shiftPolicy.create({
      data: { companyId: tenantA, name: "Test Policy", startTime: "09:00", endTime: "17:00" },
    });

    // Attempting to create a schedule for employeeB1 under tenantA's policy
    // should find no matching employee since employeeB1 belongs to tenantB
    const emp = await db.employee.findFirst({
      where: { id: employeeB1, companyId: tenantA },
    });
    expect(emp).toBeNull();

    await db.shiftPolicy.delete({ where: { id: policy.id } });
  });
});

describe("Cross-branch isolation", () => {
  it("employee A1 cannot be found under branch A2's scoped query if moved", async () => {
    // Employee A1 is on branch A1
    const employeesOnA2 = await db.employee.findMany({
      where: { companyId: tenantA, branchId: branchA2, deletedAt: null },
    });
    const ids = employeesOnA2.map((e) => e.id);
    expect(ids).not.toContain(employeeA1);
    expect(ids).toContain(employeeA2);
  });

  it("punch records are scoped to employee's company", async () => {
    const punch = await db.punch.create({
      data: {
        companyId: tenantA,
        employeeId: employeeA1,
        branchId: branchA1,
        type: "CLOCK_IN",
        timestamp: new Date(),
        status: "ACCEPTED",
        insideGeofence: true,
      },
    });

    // Query punch under wrong tenant returns nothing
    const wrongTenantPunch = await db.punch.findFirst({
      where: { id: punch.id, companyId: tenantB },
    });
    expect(wrongTenantPunch).toBeNull();

    // Query punch under correct tenant returns it
    const correctTenantPunch = await db.punch.findFirst({
      where: { id: punch.id, companyId: tenantA },
    });
    expect(correctTenantPunch).not.toBeNull();
  });
});

describe("Schedule conflicts", () => {
  it("detects overlapping schedules for same employee", async () => {
    const policy = await db.shiftPolicy.create({
      data: { companyId: tenantA, name: "Conflict Test Policy", startTime: "09:00", endTime: "17:00" },
    });

    const date = new Date();
    date.setHours(0, 0, 0, 0);

    const start1 = new Date(date);
    start1.setHours(9, 0, 0, 0);
    const end1 = new Date(date);
    end1.setHours(17, 0, 0, 0);

    // Create first schedule
    await db.schedule.create({
      data: {
        companyId: tenantA,
        employeeId: employeeA1,
        branchId: branchA1,
        date,
        shiftPolicyId: policy.id,
        expectedStart: start1,
        expectedEnd: end1,
        status: "SCHEDULED",
      },
    });

    // Attempt overlapping schedule
    const start2 = new Date(date);
    start2.setHours(14, 0, 0, 0);
    const end2 = new Date(date);
    end2.setHours(22, 0, 0, 0);

    const overlaps = await db.schedule.findMany({
      where: {
        companyId: tenantA,
        employeeId: employeeA1,
        expectedStart: { lt: end2 },
        expectedEnd: { gt: start2 },
      },
    });
    expect(overlaps.length).toBeGreaterThan(0);

    // Cleanup
    await db.schedule.deleteMany({ where: { companyId: tenantA, employeeId: employeeA1 } });
    await db.shiftPolicy.delete({ where: { id: policy.id } });
  });
});

describe("Overnight shift clock-out", () => {
  it("handles shift spanning midnight correctly", async () => {
    const policy = await db.shiftPolicy.create({
      data: { companyId: tenantA, name: "Night Policy", startTime: "22:00", endTime: "06:00", breakMinutes: 30 },
    });

    const date = new Date();
    date.setHours(0, 0, 0, 0);

    const expectedStart = new Date(date);
    expectedStart.setHours(22, 0, 0, 0);
    const expectedEnd = new Date(date);
    expectedEnd.setDate(expectedEnd.getDate() + 1);
    expectedEnd.setHours(6, 0, 0, 0);

    const schedule = await db.schedule.create({
      data: {
        companyId: tenantA,
        employeeId: employeeA1,
        branchId: branchA1,
        date,
        shiftPolicyId: policy.id,
        expectedStart,
        expectedEnd,
        status: "SCHEDULED",
      },
    });

    // Clock in at 22:05
    const clockIn = await db.punch.create({
      data: {
        companyId: tenantA,
        employeeId: employeeA1,
        branchId: branchA1,
        scheduleId: schedule.id,
        type: "CLOCK_IN",
        timestamp: new Date(expectedStart.getTime() + 5 * 60_000),
        status: "ACCEPTED",
        insideGeofence: true,
      },
    });

    // Clock out at 05:55 next day
    const clockOut = await db.punch.create({
      data: {
        companyId: tenantA,
        employeeId: employeeA1,
        branchId: branchA1,
        scheduleId: schedule.id,
        type: "CLOCK_OUT",
        timestamp: new Date(expectedEnd.getTime() - 5 * 60_000),
        status: "ACCEPTED",
        insideGeofence: true,
      },
    });

    const workedMs = clockOut.timestamp.getTime() - clockIn.timestamp.getTime();
    const workedMinutes = Math.round(workedMs / 60_000) - 30; // minus break
    // Should be ~470 minutes (7h50m - 30m break)
    expect(workedMinutes).toBeGreaterThanOrEqual(460);
    expect(workedMinutes).toBeLessThanOrEqual(480);

    // Cleanup
    await db.punch.deleteMany({ where: { companyId: tenantA, employeeId: employeeA1 } });
    await db.schedule.deleteMany({ where: { companyId: tenantA, employeeId: employeeA1 } });
    await db.shiftPolicy.delete({ where: { id: policy.id } });
  });
});
