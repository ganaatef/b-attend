import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getPermissionAccessScopes } from "@/lib/auth/authorization";

const db = new PrismaClient();

let tenantId: string;
let managerId: string;
let branchAId: string;
let branchBId: string;
let departmentId: string;
let roleId: string;

beforeAll(async () => {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tenant = await db.tenant.create({
    data: {
      name: "Permission Scope Runtime Test",
      slug: `scope-runtime-${unique}`,
      ownerEmail: `owner-${unique}@scope.test`,
      ownerName: "Scope Owner",
      ownerPhone: "+201000000099",
      status: "ACTIVE",
    },
  });
  tenantId = tenant.id;

  const manager = await db.user.create({
    data: {
      companyId: tenantId,
      email: `manager-${unique}@scope.test`,
      passwordHash: "$2b$10$scopefixturehashnotusedforlogin000000000000000000000000",
      name: "Scoped Manager",
      role: "BRANCH_MANAGER",
      status: "ACTIVE",
    },
  });
  managerId = manager.id;

  const [branchA, branchB, department] = await Promise.all([
    db.branch.create({ data: { companyId: tenantId, name: "Scoped Branch A", code: `A-${unique}`, status: "ACTIVE" } }),
    db.branch.create({ data: { companyId: tenantId, name: "Scoped Branch B", code: `B-${unique}`, status: "ACTIVE" } }),
    db.department.create({ data: { companyId: tenantId, name: `Scoped Department ${unique}` } }),
  ]);
  branchAId = branchA.id;
  branchBId = branchB.id;
  departmentId = department.id;

  const role = await db.tenantRole.create({
    data: {
      companyId: tenantId,
      code: `OPS_MANAGER_${unique.replaceAll("-", "_").toUpperCase()}`,
      name: "Operations Manager",
      isSystem: false,
      permissions: {
        create: { companyId: tenantId, permissionKey: "attendance.team.view" },
      },
    },
  });
  roleId = role.id;
});

afterAll(async () => {
  await db.userRoleAssignment.deleteMany({ where: { companyId: tenantId } });
  await db.tenantRolePermission.deleteMany({ where: { companyId: tenantId } });
  await db.tenantRole.deleteMany({ where: { companyId: tenantId } });
  await db.department.deleteMany({ where: { companyId: tenantId } });
  await db.branch.deleteMany({ where: { companyId: tenantId } });
  await db.user.deleteMany({ where: { companyId: tenantId } });
  await db.tenant.delete({ where: { id: tenantId } });
  await db.$disconnect();
});

describe("getPermissionAccessScopes", () => {
  it("returns only the assigned branch for a branch-scoped custom role", async () => {
    await db.userRoleAssignment.create({
      data: {
        companyId: tenantId,
        userId: managerId,
        roleId,
        scopeType: "BRANCH",
        scopeId: branchAId,
        scopeKey: branchAId,
      },
    });

    const scopes = await getPermissionAccessScopes({
      companyId: tenantId,
      userId: managerId,
      legacyRole: "BRANCH_MANAGER",
      permission: "attendance.team.view",
    });

    expect(scopes.tenant).toBe(false);
    expect(scopes.branchIds).toEqual([branchAId]);
    expect(scopes.branchIds).not.toContain(branchBId);
    expect(scopes.departmentIds).toEqual([]);
    expect(scopes.self).toBe(false);
  });

  it("unions multiple authorized scopes without widening to tenant access", async () => {
    await db.userRoleAssignment.create({
      data: {
        companyId: tenantId,
        userId: managerId,
        roleId,
        scopeType: "DEPARTMENT",
        scopeId: departmentId,
        scopeKey: departmentId,
      },
    });

    const scopes = await getPermissionAccessScopes({
      companyId: tenantId,
      userId: managerId,
      legacyRole: "BRANCH_MANAGER",
      permission: "attendance.team.view",
    });

    expect(scopes.tenant).toBe(false);
    expect(scopes.branchIds).toEqual([branchAId]);
    expect(scopes.departmentIds).toEqual([departmentId]);
  });

  it("tenant-scoped permission deliberately supersedes narrower scopes", async () => {
    await db.userRoleAssignment.create({
      data: {
        companyId: tenantId,
        userId: managerId,
        roleId,
        scopeType: "TENANT",
        scopeId: null,
        scopeKey: "*",
      },
    });

    const scopes = await getPermissionAccessScopes({
      companyId: tenantId,
      userId: managerId,
      legacyRole: "BRANCH_MANAGER",
      permission: "attendance.team.view",
    });

    expect(scopes.tenant).toBe(true);
    expect(scopes.branchIds).toEqual([]);
    expect(scopes.departmentIds).toEqual([]);
  });
});
