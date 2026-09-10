import fs from "node:fs";

const file = "src/app/(tenant)/hr/actions.ts";
let source = fs.readFileSync(file, "utf8");

function replaceOnce(text, from, to, label) {
  const first = text.indexOf(from);
  if (first < 0) throw new Error(`Missing migration anchor: ${label}`);
  if (text.indexOf(from, first + from.length) >= 0) throw new Error(`Ambiguous migration anchor: ${label}`);
  return text.slice(0, first) + to + text.slice(first + from.length);
}

function editFunction(name, transform) {
  const marker = `export async function ${name}`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Function not found: ${name}`);
  const next = source.indexOf("\nexport async function ", start + marker.length);
  const end = next < 0 ? source.length : next;
  const block = source.slice(start, end);
  const updated = transform(block);
  if (updated === block) throw new Error(`Function was not changed: ${name}`);
  source = source.slice(0, start) + updated + source.slice(end);
}

source = replaceOnce(
  source,
  'import { getSession } from "@/lib/auth/session";\n',
  'import { getSession } from "@/lib/auth/session";\nimport { evaluatePermission, type AuthorizationScope } from "@/lib/auth/authorization";\n',
  "IAM import",
);

source = replaceOnce(
  source,
  'import { getRolePermissions, getManagedBranchIds, type HrPermission } from "@/lib/hr/permissions";\n',
  'import { HR_PERMISSION_IAM_MAP, getManagedBranchIds, type HrPermission } from "@/lib/hr/permissions";\n',
  "HR permission import",
);

source = replaceOnce(
  source,
  `function hasPermission(role: string, permission: HrPermission): boolean {\n  return getRolePermissions(role).includes(permission);\n}\n`,
  `async function hasPermission(\n  s: { tenantId: string; userId: string; role: string },\n  permission: HrPermission,\n  scope: AuthorizationScope = {},\n): Promise<boolean> {\n  const decision = await evaluatePermission({\n    companyId: s.tenantId,\n    userId: s.userId,\n    legacyRole: s.role,\n    permission: HR_PERMISSION_IAM_MAP[permission],\n    scope,\n  });\n  return decision.allowed;\n}\n`,
  "local permission helper",
);

// Convert all coarse server-action role checks to the IAM bridge. Resource-
// scoped exceptions below are then tightened with an explicit target scope.
source = source.replaceAll("hasPermission(s.role, ", "await hasPermission(s, ");

editFunction("createLeaveRequestAction", (block) => {
  let next = block.replace(
    '    if (!await hasPermission(s, "APPROVE_LEAVE") && !await hasPermission(s, "MANAGE_LEAVE_BALANCES")) return { ok: false, error: "Permission denied" };\n',
    "",
  );
  next = replaceOnce(
    next,
    '    const emp = await db.employee.findFirst({ where: { id: parsed.data.employeeId, companyId: s.tenantId, deletedAt: null } });\n    if (!emp) return { ok: false, error: "Employee not found" };\n',
    `    const emp = await db.employee.findFirst({ where: { id: parsed.data.employeeId, companyId: s.tenantId, deletedAt: null } });\n    if (!emp) return { ok: false, error: "Employee not found" };\n    const targetScope = { branchId: emp.branchId, departmentId: emp.departmentId, targetUserId: emp.userId };\n    const canApprove = await hasPermission(s, "APPROVE_LEAVE", targetScope);\n    const canManageBalance = await hasPermission(s, "MANAGE_LEAVE_BALANCES", targetScope);\n    if (!canApprove && !canManageBalance) return { ok: false, error: "Permission denied" };\n`,
    "create leave scoped permission",
  );
  return next;
});

for (const name of ["approveLeaveRequestAction", "rejectLeaveRequestAction", "cancelLeaveRequestAction"]) {
  editFunction(name, (block) => {
    let next = block.replace(
      '    if (!await hasPermission(s, "APPROVE_LEAVE")) return { ok: false, error: "Permission denied" };\n',
      "",
    );
    next = replaceOnce(
      next,
      '    const lr = await db.leaveRequest.findFirst({ where: { id: leaveRequestId, companyId: s.tenantId } });\n    if (!lr) return { ok: false, error: "Leave request not found" };\n',
      `    const lr = await db.leaveRequest.findFirst({ where: { id: leaveRequestId, companyId: s.tenantId } });\n    if (!lr) return { ok: false, error: "Leave request not found" };\n    const targetEmployee = await db.employee.findFirst({\n      where: { id: lr.employeeId, companyId: s.tenantId, deletedAt: null },\n      select: { branchId: true, departmentId: true, userId: true },\n    });\n    if (!targetEmployee) return { ok: false, error: "Employee not found" };\n    const authorization = await evaluatePermission({\n      companyId: s.tenantId,\n      userId: s.userId,\n      legacyRole: s.role,\n      permission: HR_PERMISSION_IAM_MAP.APPROVE_LEAVE,\n      scope: {\n        branchId: targetEmployee.branchId,\n        departmentId: targetEmployee.departmentId,\n        targetUserId: targetEmployee.userId,\n      },\n    });\n    if (!authorization.allowed) return { ok: false, error: "Permission denied" };\n`,
      `${name} target permission`,
    );

    const legacyBlock = `    if (s.role === "BRANCH_MANAGER") {\n      const emp = await db.employee.findFirst({ where: { id: lr.employeeId, companyId: s.tenantId, deletedAt: null } });\n      if (!emp) return { ok: false, error: "Employee not found" };\n      if (!emp.branchId) return { ok: false, error: "Employee has no branch assigned" };\n      const managedIds = await getManagedBranchIds(s.userId, s.tenantId);\n      if (!managedIds.includes(emp.branchId)) return { ok: false, error: "Permission denied: employee not in your branch" };\n    }\n`;
    const hardenedLegacyBlock = `    // Only the legacy-role fallback needs the historical managerId boundary.\n    // Explicit IAM assignments have already been scope-matched above.\n    if (authorization.source === "legacy" && s.role === "BRANCH_MANAGER") {\n      if (!targetEmployee.branchId) return { ok: false, error: "Employee has no branch assigned" };\n      const managedIds = await getManagedBranchIds(s.userId, s.tenantId);\n      if (!managedIds.includes(targetEmployee.branchId)) return { ok: false, error: "Permission denied: employee not in your branch" };\n    }\n`;
    next = replaceOnce(next, legacyBlock, hardenedLegacyBlock, `${name} legacy branch scope`);
    return next;
  });
}

if (source.includes("getRolePermissions")) throw new Error("Legacy getRolePermissions remains in HR actions");
if (source.includes("hasPermission(s.role")) throw new Error("Legacy role permission check remains in HR actions");

fs.writeFileSync(file, source);
console.log("HR actions migrated from coarse role checks to IAM capability checks.");
