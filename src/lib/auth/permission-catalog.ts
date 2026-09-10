export const PERMISSIONS = [
  "company.view",
  "company.settings.manage",
  "billing.view",
  "billing.manage",
  "users.view",
  "users.invite",
  "users.manage",
  "users.roles.manage",
  "employees.view",
  "employees.create",
  "employees.edit",
  "employees.deactivate",
  "employees.sensitive.view",
  "branches.view",
  "branches.manage",
  "departments.view",
  "departments.manage",
  "hr.dashboard.view",
  "job_titles.manage",
  "contracts.manage",
  "warnings.manage",
  "onboarding.manage",
  "offboarding.manage",
  "hr.export",
  "attendance.self.view",
  "attendance.self.clock",
  "attendance.self.request",
  "attendance.team.view",
  "attendance.manage",
  "attendance.approve",
  "attendance.export",
  "schedules.self.view",
  "schedules.team.view",
  "schedules.manage",
  "shift_policies.view",
  "shift_policies.manage",
  "leave.self.view",
  "leave.self.request",
  "leave.team.view",
  "leave.manage",
  "leave.approve",
  "leave.types.manage",
  "leave.balances.manage",
  "payroll.view",
  "payroll.manage",
  "payroll.export",
  "documents.self.view",
  "documents.manage",
  "training.self.view",
  "training.manage",
  "assets.self.view",
  "assets.manage",
  "reports.view",
  "reports.export",
  "audit.view",
  "kiosk.manage",
  "integrations.manage",
  "ai.use",
  "support.use",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const PERMISSION_SET = new Set<string>(PERMISSIONS);

export const PERMISSION_GROUPS: ReadonlyArray<{
  key: string;
  label: string;
  permissions: readonly PermissionKey[];
}> = [
  {
    key: "company",
    label: "Company & billing",
    permissions: ["company.view", "company.settings.manage", "billing.view", "billing.manage"],
  },
  {
    key: "access",
    label: "Users & access",
    permissions: ["users.view", "users.invite", "users.manage", "users.roles.manage", "audit.view"],
  },
  {
    key: "workforce",
    label: "Employees, branches & departments",
    permissions: [
      "employees.view",
      "employees.create",
      "employees.edit",
      "employees.deactivate",
      "employees.sensitive.view",
      "branches.view",
      "branches.manage",
      "departments.view",
      "departments.manage",
      "hr.dashboard.view",
      "job_titles.manage",
      "contracts.manage",
      "warnings.manage",
      "onboarding.manage",
      "offboarding.manage",
      "hr.export",
    ],
  },
  {
    key: "attendance",
    label: "Attendance, schedules & shift policies",
    permissions: [
      "attendance.self.view",
      "attendance.self.clock",
      "attendance.self.request",
      "attendance.team.view",
      "attendance.manage",
      "attendance.approve",
      "attendance.export",
      "schedules.self.view",
      "schedules.team.view",
      "schedules.manage",
      "shift_policies.view",
      "shift_policies.manage",
    ],
  },
  {
    key: "hr",
    label: "HR operations",
    permissions: [
      "leave.self.view",
      "leave.self.request",
      "leave.team.view",
      "leave.manage",
      "leave.approve",
      "leave.types.manage",
      "leave.balances.manage",
      "payroll.view",
      "payroll.manage",
      "payroll.export",
      "documents.self.view",
      "documents.manage",
      "training.self.view",
      "training.manage",
      "assets.self.view",
      "assets.manage",
    ],
  },
  {
    key: "platform",
    label: "Reporting & platform tools",
    permissions: ["reports.view", "reports.export", "kiosk.manage", "integrations.manage", "ai.use", "support.use"],
  },
] as const;

export const SYSTEM_ROLE_CODES = {
  OWNER: "OWNER",
  HR_ADMIN: "HR_ADMIN",
  BRANCH_MANAGER: "BRANCH_MANAGER",
  EMPLOYEE: "EMPLOYEE",
} as const;

export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[keyof typeof SYSTEM_ROLE_CODES];

const ALL = [...PERMISSIONS] as PermissionKey[];

export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRoleCode, readonly PermissionKey[]> = {
  OWNER: ALL,
  HR_ADMIN: PERMISSIONS.filter((permission) => !["billing.manage", "users.roles.manage"].includes(permission)),
  BRANCH_MANAGER: [
    "company.view",
    "employees.view",
    "employees.edit",
    "branches.view",
    "departments.view",
    "hr.dashboard.view",
    "hr.export",
    "attendance.self.request",
    "attendance.team.view",
    "attendance.approve",
    "attendance.export",
    "schedules.team.view",
    "schedules.manage",
    "shift_policies.view",
    "leave.self.request",
    "leave.team.view",
    "leave.approve",
    "training.self.view",
    "training.manage",
    "assets.self.view",
    "reports.view",
    "reports.export",
    "ai.use",
    "support.use",
  ],
  EMPLOYEE: [
    "company.view",
    "attendance.self.view",
    "attendance.self.clock",
    "attendance.self.request",
    "schedules.self.view",
    "leave.self.view",
    "leave.self.request",
    "documents.self.view",
    "training.self.view",
    "assets.self.view",
    "ai.use",
    "support.use",
  ],
};

export function permissionsForLegacyRole(role: string): readonly PermissionKey[] {
  switch (role) {
    case "COMPANY_OWNER":
      return SYSTEM_ROLE_PERMISSIONS.OWNER;
    case "HR_ADMIN":
      return SYSTEM_ROLE_PERMISSIONS.HR_ADMIN;
    case "BRANCH_MANAGER":
      return SYSTEM_ROLE_PERMISSIONS.BRANCH_MANAGER;
    case "EMPLOYEE":
      return SYSTEM_ROLE_PERMISSIONS.EMPLOYEE;
    default:
      return [];
  }
}

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_SET.has(value);
}
