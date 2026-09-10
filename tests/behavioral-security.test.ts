/**
 * Behavioral tests — authorization enforcement in real server actions.
 *
 * Each scenario invokes the actual action handler with a mocked session and
 * database, then asserts: the operation fails, no cross-scope data is
 * returned, and the database is not mutated.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  branch: { findFirst: vi.fn(), findMany: vi.fn() },
  employee: { findFirst: vi.fn(), findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  userRoleAssignment: { findMany: vi.fn() },
  shiftPolicy: { findFirst: vi.fn() },
  schedule: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  punch: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  attendanceDay: { upsert: vi.fn(), findMany: vi.fn() },
  approvalRequest: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  auditLog: { create: vi.fn() },
  platformAuditLog: { create: vi.fn() },
  tenant: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { getSession } from "@/lib/auth/session";
import { createScheduleAction } from "@/app/(tenant)/actions";
import { decideRequestAction } from "@/app/(tenant)/approvals/actions";
import { clockAction } from "@/app/(tenant)/clock/actions";
import { createPayrollRunAction } from "@/app/(tenant)/hr/actions";
import { hasHrPermission, canViewSalary } from "@/lib/hr/permissions";

const TENANT_ID = "tenant-1";

function tenantSession(role: string, sub: string) {
  return {
    sub,
    kind: "tenant",
    role,
    tenantId: TENANT_ID,
    name: "User",
    email: `${role.toLowerCase()}@test.com`,
  } as any;
}

function scheduleForm(overrides: Record<string, string>) {
  const fd = new FormData();
  fd.set("employeeId", "emp-1");
  fd.set("branchId", "branch-a");
  fd.set("date", "2026-08-12");
  fd.set("shiftPolicyId", "policy-1");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default to the migration-compatible legacy-role fallback. Individual IAM
  // tests can override this with scoped role assignments when needed.
  dbMock.userRoleAssignment.findMany.mockResolvedValue([]);
});

describe("Manager cannot write schedules across branches", () => {
  it("rejects scheduling into a branch the manager does not manage", async () => {
    vi.mocked(getSession).mockResolvedValue(tenantSession("BRANCH_MANAGER", "user-mgr"));
    dbMock.employee.findFirst.mockResolvedValue({
      id: "emp-other",
      companyId: TENANT_ID,
      branchId: "branch-b",
      deletedAt: null,
    });
    // Manager manages only branch-a.
    dbMock.branch.findMany.mockResolvedValue([{ id: "branch-a", managerId: "user-mgr" }]);

    const r = await createScheduleAction({}, scheduleForm({ branchId: "branch-b", employeeId: "emp-other" }));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Cannot schedule for branches you don't manage");
    expect(dbMock.schedule.create).not.toHaveBeenCalled();
    expect(dbMock.schedule.findUnique).not.toHaveBeenCalled();
  });

  it("rejects scheduling an employee who belongs to another branch", async () => {
    vi.mocked(getSession).mockResolvedValue(tenantSession("BRANCH_MANAGER", "user-mgr"));
    dbMock.employee.findFirst.mockResolvedValue({
      id: "emp-b",
      companyId: TENANT_ID,
      branchId: "branch-b",
      deletedAt: null,
    });
    // Manager manages branch-a and schedules into it, but the employee is from branch-b.
    dbMock.branch.findMany.mockResolvedValue([{ id: "branch-a", managerId: "user-mgr" }]);

    const r = await createScheduleAction({}, scheduleForm({ branchId: "branch-a", employeeId: "emp-b" }));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Employee must belong to the selected branch");
    expect(dbMock.schedule.create).not.toHaveBeenCalled();
  });

  it("does not return any schedule data to the manager on rejection", async () => {
    vi.mocked(getSession).mockResolvedValue(tenantSession("BRANCH_MANAGER", "user-mgr"));
    dbMock.employee.findFirst.mockResolvedValue({
      id: "emp-b",
      companyId: TENANT_ID,
      branchId: "branch-b",
      deletedAt: null,
    });
    dbMock.branch.findMany.mockResolvedValue([{ id: "branch-a", managerId: "user-mgr" }]);

    const r = await createScheduleAction({}, scheduleForm({ branchId: "branch-b", employeeId: "emp-b" }));

    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("emp-b");
    expect(JSON.stringify(r)).not.toContain("branch-b");
  });
});

describe("Employee cannot read or act on another employee", () => {
  it("rejects an EMPLOYEE clocking in as someone else", async () => {
    vi.mocked(getSession).mockResolvedValue(tenantSession("EMPLOYEE", "user-emp"));
    dbMock.employee.findUnique.mockResolvedValue({
      id: "emp-other",
      companyId: TENANT_ID,
      status: "ACTIVE",
      userId: "user-different",
      branchId: "branch-a",
      departmentId: null,
      branch: { latitude: 0, longitude: 0, geofenceRadius: 150 },
    });

    const fd = new FormData();
    fd.set("employeeId", "emp-other");
    fd.set("type", "CLOCK_IN");
    fd.set("latitude", "0");
    fd.set("longitude", "0");
    fd.set("source", "MOBILE_WEB");

    const r = await clockAction({}, fd);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("You can only clock for yourself");
    expect(dbMock.punch.create).not.toHaveBeenCalled();
    expect(dbMock.schedule.findUnique).not.toHaveBeenCalled();
  });
});

describe("Employee cannot self-approve requests", () => {
  it("rejects a manager approving their own request", async () => {
    vi.mocked(getSession).mockResolvedValue(tenantSession("BRANCH_MANAGER", "user-mgr"));
    dbMock.approvalRequest.findFirst.mockResolvedValue({
      id: "req-1",
      companyId: TENANT_ID,
      status: "PENDING",
      requestedById: "user-mgr",
      branchId: "branch-a",
      employeeId: "emp-1",
      date: new Date("2026-08-12"),
      type: "MANUAL_CLOCK_IN",
      requestedData: null,
    });

    const fd = new FormData();
    fd.set("requestId", "req-1");
    fd.set("decision", "APPROVED");

    const r = await decideRequestAction({}, fd);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("your own request");
    expect(dbMock.approvalRequest.update).not.toHaveBeenCalled();
    expect(dbMock.punch.create).not.toHaveBeenCalled();
  });
});

describe("Unauthorized payroll access is rejected", () => {
  it("denies payroll run creation for EMPLOYEE role", async () => {
    vi.mocked(getSession).mockResolvedValue(tenantSession("EMPLOYEE", "user-emp"));

    const fd = new FormData();
    fd.set("month", "8");
    fd.set("year", "2026");

    const r = await createPayrollRunAction({}, fd);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Permission denied");
    // The payroll generator is never reached.
    expect(dbMock.tenant.findUnique).not.toHaveBeenCalled();
  });

  it("denies VIEW_PAYROLL to BRANCH_MANAGER and EMPLOYEE", async () => {
    vi.mocked(getSession).mockResolvedValue(tenantSession("BRANCH_MANAGER", "user-mgr"));
    expect(await hasHrPermission("VIEW_PAYROLL")).toBe(false);

    vi.mocked(getSession).mockResolvedValue(tenantSession("EMPLOYEE", "user-emp"));
    expect(await hasHrPermission("VIEW_PAYROLL")).toBe(false);
  });

  it("grants VIEW_PAYROLL to COMPANY_OWNER and HR_ADMIN only", async () => {
    expect(await canViewSalary({ role: "COMPANY_OWNER" })).toBe(true);
    expect(await canViewSalary({ role: "HR_ADMIN" })).toBe(true);
    expect(await canViewSalary({ role: "BRANCH_MANAGER" })).toBe(false);
    expect(await canViewSalary({ role: "EMPLOYEE" })).toBe(false);
  });
});