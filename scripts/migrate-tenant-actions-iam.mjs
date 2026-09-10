import fs from "node:fs";

const file = "src/app/(tenant)/actions.ts";
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
  'import { getSession } from "@/lib/auth/session";\nimport { evaluatePermission, requirePermission } from "@/lib/auth/authorization";\n',
  "authorization import",
);

source = replaceOnce(
  source,
  `async function requireTenant() {\n  const s = await getSession();\n  if (!s || s.kind !== "tenant" || !s.tenantId) throw new Error("FORBIDDEN");\n  return s;\n}\n\nasync function requireTenantAdmin() {\n  const s = await requireTenant();\n  if (s.role !== "COMPANY_OWNER" && s.role !== "HR_ADMIN") throw new Error("FORBIDDEN");\n  return s;\n}\n`,
  `async function requireTenant() {\n  const s = await getSession();\n  if (!s || s.kind !== "tenant" || !s.tenantId) throw new Error("FORBIDDEN");\n  return { ...s, tenantId: s.tenantId };\n}\n`,
  "tenant guard",
);

for (const [name, permission] of [
  ["onboardingStep1Action", "company.settings.manage"],
  ["onboardingCreateBranchAction", "branches.manage"],
  ["onboardingCreateDepartmentsAction", "departments.manage"],
  ["onboardingCreatePolicyAction", "shift_policies.manage"],
  ["createBranchAction", "branches.manage"],
  ["createDepartmentAction", "departments.manage"],
  ["createPolicyAction", "shift_policies.manage"],
]) {
  editFunction(name, (block) => {
    const oldGuard = block.includes("const s = await requireTenantAdmin();")
      ? "const s = await requireTenantAdmin();"
      : "const s = await requireTenant();";
    return replaceOnce(block, oldGuard, `const { session: s } = await requirePermission("${permission}");`, `${name} guard`);
  });
}

for (const name of ["updateBranchAction", "deleteBranchAction"]) {
  editFunction(name, (block) => replaceOnce(
    block,
    "const s = await requireTenantAdmin();",
    'const { session: s } = await requirePermission("branches.manage", { branchId });',
    `${name} guard`,
  ));
}

editFunction("deleteDepartmentAction", (block) => replaceOnce(
  block,
  "const s = await requireTenantAdmin();",
  'const { session: s } = await requirePermission("departments.manage", { departmentId });',
  "deleteDepartmentAction guard",
));

editFunction("createEmployeeAction", (block) => {
  let next = replaceOnce(block, "    const s = await requireTenantAdmin();\n", "", "create employee old guard");
  next = replaceOnce(
    next,
    "    const d = parsed.data;\n",
    `    const d = parsed.data;\n    const { session: s } = await requirePermission("employees.create", {\n      branchId: d.branchId,\n      departmentId: d.departmentId || null,\n    });\n`,
    "create employee scoped guard",
  );
  return next;
});

editFunction("updateEmployeeAction", (block) => {
  let next = replaceOnce(block, "    const s = await requireTenantAdmin();\n", "    const base = await requireTenant();\n", "update employee base guard");
  next = replaceOnce(
    next,
    `    const emp = await db.employee.findFirst({ where: { id: employeeId, companyId: s.tenantId! } });\n    if (!emp) return { ok: false, error: "Employee not found" };\n`,
    `    const emp = await db.employee.findFirst({ where: { id: employeeId, companyId: base.tenantId } });\n    if (!emp) return { ok: false, error: "Employee not found" };\n    const { session: s } = await requirePermission("employees.edit", {\n      branchId: emp.branchId,\n      departmentId: emp.departmentId,\n      targetUserId: emp.userId,\n    });\n`,
    "update employee scoped guard",
  );
  return next;
});

editFunction("deleteEmployeeAction", (block) => {
  let next = replaceOnce(block, "    const s = await requireTenantAdmin();\n", "    const base = await requireTenant();\n", "delete employee base guard");
  next = replaceOnce(
    next,
    `    await db.employee.update({ where: { id: employeeId, companyId: s.tenantId! }, data: { deletedAt: new Date(), status: "LEFT" } });\n`,
    `    const emp = await db.employee.findFirst({ where: { id: employeeId, companyId: base.tenantId, deletedAt: null } });\n    if (!emp) return { ok: false, error: "Employee not found" };\n    const { session: s } = await requirePermission("employees.deactivate", {\n      branchId: emp.branchId,\n      departmentId: emp.departmentId,\n      targetUserId: emp.userId,\n    });\n    await db.employee.update({ where: { id: employeeId, companyId: s.tenantId! }, data: { deletedAt: new Date(), status: "LEFT" } });\n`,
    "delete employee scoped guard",
  );
  return next;
});

editFunction("createScheduleAction", (block) => {
  let next = replaceOnce(
    block,
    `    const employee = await db.employee.findFirst({ where: { id: d.employeeId, companyId: s.tenantId!, deletedAt: null } });\n    if (!employee) return { ok: false, error: "Employee not found or inactive" };\n\n    if (isManager(s.role!)) {\n`,
    `    const employee = await db.employee.findFirst({ where: { id: d.employeeId, companyId: s.tenantId, deletedAt: null } });\n    if (!employee) return { ok: false, error: "Employee not found or inactive" };\n    if (employee.branchId !== d.branchId) return { ok: false, error: "Employee must belong to the selected branch" };\n\n    const authorization = await evaluatePermission({\n      companyId: s.tenantId,\n      userId: s.sub,\n      legacyRole: s.role,\n      permission: "schedules.manage",\n      scope: { branchId: d.branchId, departmentId: employee.departmentId, targetUserId: employee.userId },\n    });\n    if (!authorization.allowed) return { ok: false, error: "Permission denied" };\n\n    if (authorization.source === "legacy" && isManager(s.role!)) {\n`,
    "create schedule IAM gate",
  );
  // The branch/employee consistency check is now unconditional, so remove the
  // duplicate inside the legacy-manager compatibility block.
  next = next.replace('      if (employee.branchId !== d.branchId) return { ok: false, error: "Employee must belong to the selected branch" };\n', "");
  return next;
});

editFunction("updateScheduleAction", (block) => replaceOnce(
  block,
  `    if (!schedule) return { ok: false, error: "Schedule not found" };\n\n    if (isManager(s.role!) && schedule.branchId) {\n`,
  `    if (!schedule) return { ok: false, error: "Schedule not found" };\n    const employee = await db.employee.findFirst({\n      where: { id: schedule.employeeId, companyId: s.tenantId, deletedAt: null },\n      select: { branchId: true, departmentId: true, userId: true },\n    });\n    if (!employee) return { ok: false, error: "Employee not found" };\n    const authorization = await evaluatePermission({\n      companyId: s.tenantId,\n      userId: s.sub,\n      legacyRole: s.role,\n      permission: "schedules.manage",\n      scope: { branchId: schedule.branchId ?? employee.branchId, departmentId: employee.departmentId, targetUserId: employee.userId },\n    });\n    if (!authorization.allowed) return { ok: false, error: "Permission denied" };\n\n    if (authorization.source === "legacy" && isManager(s.role!) && schedule.branchId) {\n`,
  "update schedule IAM gate",
));

editFunction("bulkScheduleAction", (block) => {
  return replaceOnce(
    block,
    `    if (!policy) return { ok: false, error: "Shift policy not found" };\n\n    if (isManager(s.role!)) {\n      const managedBranches = await getManagedBranchIds(s.sub, s.tenantId!);\n      if (!managedBranches.includes(d.branchId)) return { ok: false, error: "Cannot schedule for branches you don't manage" };\n      const branchEmps = await db.employee.findMany({ where: { companyId: s.tenantId!, branchId: d.branchId, deletedAt: null }, select: { id: true } });\n      const allowedIds = new Set(branchEmps.map((e) => e.id));\n      const invalid = employeeIds.filter((id) => !allowedIds.has(id));\n      if (invalid.length > 0) return { ok: false, error: "Some employees do not belong to the selected branch" };\n    }\n`,
    `    if (!policy) return { ok: false, error: "Shift policy not found" };\n\n    // Always bind selected employees to the target branch; this is a data-\n    // integrity rule, not merely a branch-manager role rule.\n    const branchEmps = await db.employee.findMany({ where: { companyId: s.tenantId, branchId: d.branchId, deletedAt: null }, select: { id: true } });\n    const allowedIds = new Set(branchEmps.map((e) => e.id));\n    const invalid = employeeIds.filter((id) => !allowedIds.has(id));\n    if (invalid.length > 0) return { ok: false, error: "Some employees do not belong to the selected branch" };\n\n    const authorization = await evaluatePermission({\n      companyId: s.tenantId,\n      userId: s.sub,\n      legacyRole: s.role,\n      permission: "schedules.manage",\n      scope: { branchId: d.branchId },\n    });\n    if (!authorization.allowed) return { ok: false, error: "Permission denied" };\n\n    if (authorization.source === "legacy" && isManager(s.role!)) {\n      const managedBranches = await getManagedBranchIds(s.sub, s.tenantId);\n      if (!managedBranches.includes(d.branchId)) return { ok: false, error: "Cannot schedule for branches you don't manage" };\n    }\n`,
    "bulk schedule IAM gate",
  );
});

editFunction("deleteScheduleAction", (block) => replaceOnce(
  block,
  `    if (!schedule) return { ok: false, error: "Schedule not found" };\n    if (typeof s.role === "string" && isManager(s.role) && schedule.branchId) {\n`,
  `    if (!schedule) return { ok: false, error: "Schedule not found" };\n    const employee = await db.employee.findFirst({\n      where: { id: schedule.employeeId, companyId: s.tenantId, deletedAt: null },\n      select: { branchId: true, departmentId: true, userId: true },\n    });\n    if (!employee) return { ok: false, error: "Employee not found" };\n    const authorization = await evaluatePermission({\n      companyId: s.tenantId,\n      userId: s.sub,\n      legacyRole: s.role,\n      permission: "schedules.manage",\n      scope: { branchId: schedule.branchId ?? employee.branchId, departmentId: employee.departmentId, targetUserId: employee.userId },\n    });\n    if (!authorization.allowed) return { ok: false, error: "Permission denied" };\n    if (authorization.source === "legacy" && typeof s.role === "string" && isManager(s.role) && schedule.branchId) {\n`,
  "delete schedule IAM gate",
));

if (source.includes("requireTenantAdmin")) throw new Error("Legacy requireTenantAdmin remains after migration");

fs.writeFileSync(file, source);
console.log("Tenant entity actions migrated to scoped IAM guards.");
