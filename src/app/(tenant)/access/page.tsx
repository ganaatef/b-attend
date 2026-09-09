import { getLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Shield, UserCheck, UserPlus, UsersRound } from "lucide-react";
import { db } from "@/lib/db";
import { ensureSystemRoles, getEffectivePermissions, requirePermission } from "@/lib/auth/authorization";
import { AccessClient } from "./AccessClient";
import { RevokeInvitationAction, UserStatusAction } from "./AccessRowActions";

export const dynamic = "force-dynamic";

function scopeLabel(scopeType: string, scopeId: string | null, branches: Map<string, string>, departments: Map<string, string>, isArabic: boolean) {
  if (scopeType === "TENANT") return isArabic ? "كل الشركة" : "Company-wide";
  if (scopeType === "SELF") return isArabic ? "نفسه فقط" : "Self only";
  if (scopeType === "BRANCH") return branches.get(scopeId || "") || (isArabic ? "فرع" : "Branch");
  if (scopeType === "DEPARTMENT") return departments.get(scopeId || "") || (isArabic ? "قسم" : "Department");
  return scopeType;
}

export default async function AccessPage() {
  const locale = await getLocale();
  const isArabic = locale === "ar";
  const { session } = await requirePermission("users.view");
  const companyId = session.tenantId!;

  const systemRoleCount = await db.tenantRole.count({ where: { companyId, isSystem: true, deletedAt: null } });
  if (systemRoleCount < 4) await ensureSystemRoles(companyId);

  const [roles, users, invitations, employeeRecords, branches, departments, effectivePermissions] = await Promise.all([
    db.tenantRole.findMany({
      where: { companyId, deletedAt: null },
      include: { permissions: true, _count: { select: { assignments: true } } },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    }),
    db.user.findMany({
      where: { companyId, deletedAt: null },
      include: {
        employee: { select: { id: true, employeeCode: true, fullName: true } },
        roleAssignments: {
          where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          include: { role: { select: { id: true, code: true, name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    db.userInvitation.findMany({
      where: { companyId, status: "PENDING", revokedAt: null, expiresAt: { gt: new Date() } },
      include: { roles: { include: { role: { select: { code: true, name: true } } } }, employee: { select: { employeeCode: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.employee.findMany({
      where: { companyId, deletedAt: null },
      include: { user: { select: { id: true } } },
      orderBy: { employeeCode: "asc" },
    }),
    db.branch.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.department.findMany({ where: { companyId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getEffectivePermissions({ companyId, userId: session.sub, legacyRole: session.role }),
  ]);

  const canInvite = effectivePermissions.includes("users.invite");
  const canManageUsers = effectivePermissions.includes("users.manage");
  const canManageRoles = effectivePermissions.includes("users.roles.manage");
  const unlinkedEmployees = employeeRecords.filter((employee) => !employee.user);
  const branchNames = new Map(branches.map((branch) => [branch.id, branch.name]));
  const departmentNames = new Map(departments.map((department) => [department.id, department.name]));

  return (
    <div className="mx-auto max-w-7xl space-y-6" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary"><Shield className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wider">IAM</span></div>
          <h1 className="text-2xl font-bold text-foreground">{isArabic ? "المستخدمون والصلاحيات" : "Users & access control"}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {isArabic
              ? "إدارة حسابات الدخول مستقلة عن سجلات الموظفين، مع أدوار وصلاحيات ونطاقات وصول قابلة للتخصيص"
              : "Login identities are separate from employee records, with customizable roles, permissions, and scoped access."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{isArabic ? "المستخدمون" : "Users"}</p><p className="mt-1 text-2xl font-bold">{users.length}</p></div><UsersRound className="h-5 w-5 text-primary" /></div></Card>
        <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{isArabic ? "الدعوات المعلقة" : "Pending invites"}</p><p className="mt-1 text-2xl font-bold">{invitations.length}</p></div><UserPlus className="h-5 w-5 text-primary" /></div></Card>
        <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{isArabic ? "الأدوار" : "Roles"}</p><p className="mt-1 text-2xl font-bold">{roles.length}</p></div><Shield className="h-5 w-5 text-primary" /></div></Card>
        <Card className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{isArabic ? "موظفون بلا حساب" : "Employees without login"}</p><p className="mt-1 text-2xl font-bold">{unlinkedEmployees.length}</p></div><UserCheck className="h-5 w-5 text-primary" /></div></Card>
      </div>

      <AccessClient
        roles={roles.map((role) => ({ id: role.id, name: role.name, code: role.code, isSystem: role.isSystem }))}
        employees={unlinkedEmployees.map((employee) => ({ id: employee.id, fullName: employee.fullName, employeeCode: employee.employeeCode, email: employee.email }))}
        branches={branches}
        departments={departments}
        canInvite={canInvite}
        canManageRoles={canManageRoles}
        isArabic={isArabic}
      />

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold text-foreground">{isArabic ? "حسابات المستخدمين" : "User accounts"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{isArabic ? "تعطيل الحساب يوقف تسجيل الدخول ولا يحذف سجل الموظف" : "Suspending a login does not delete the employee HR record."}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-start font-medium">{isArabic ? "المستخدم" : "User"}</th>
                <th className="px-5 py-3 text-start font-medium">{isArabic ? "الموظف المرتبط" : "Employee link"}</th>
                <th className="px-5 py-3 text-start font-medium">{isArabic ? "الأدوار والنطاق" : "Roles & scope"}</th>
                <th className="px-5 py-3 text-start font-medium">{isArabic ? "الحالة" : "Status"}</th>
                <th className="px-5 py-3 text-end font-medium">{isArabic ? "إجراء" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border/60 last:border-0">
                  <td className="px-5 py-4"><p className="font-medium text-foreground">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></td>
                  <td className="px-5 py-4 text-muted-foreground">{user.employee ? `${user.employee.employeeCode} — ${user.employee.fullName}` : (isArabic ? "حساب إداري" : "Administrative account")}</td>
                  <td className="px-5 py-4">
                    <div className="flex max-w-xl flex-wrap gap-1.5">
                      {user.roleAssignments.length > 0 ? user.roleAssignments.map((assignment) => (
                        <Badge key={assignment.id} variant="outline" className="font-normal">
                          {assignment.role.name} · {scopeLabel(assignment.scopeType, assignment.scopeId, branchNames, departmentNames, isArabic)}
                        </Badge>
                      )) : <Badge variant="outline">{user.role.replaceAll("_", " ")} · {isArabic ? "وضع التوافق" : "compatibility mode"}</Badge>}
                    </div>
                  </td>
                  <td className="px-5 py-4"><Badge variant={user.status === "ACTIVE" ? "default" : "secondary"}>{user.status}</Badge></td>
                  <td className="px-5 py-4 text-end">
                    {canManageUsers && user.role !== "COMPANY_OWNER" ? <UserStatusAction userId={user.id} suspended={user.status === "SUSPENDED"} isArabic={isArabic} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {invitations.length > 0 ? (
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4"><h2 className="font-semibold text-foreground">{isArabic ? "الدعوات المعلقة" : "Pending invitations"}</h2></div>
          <div className="divide-y divide-border">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-center">
                <div><p className="font-medium text-foreground">{invitation.name}</p><p className="text-xs text-muted-foreground">{invitation.email}</p></div>
                <div className="text-xs text-muted-foreground">{invitation.roles.map((role) => role.role.name).join(", ")}</div>
                <div className="text-xs text-muted-foreground">{isArabic ? "تنتهي " : "Expires "}{new Intl.DateTimeFormat(isArabic ? "ar-EG" : "en", { dateStyle: "medium", timeStyle: "short" }).format(invitation.expiresAt)}</div>
                {canManageUsers ? <RevokeInvitationAction invitationId={invitation.id} isArabic={isArabic} /> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4"><h2 className="font-semibold text-foreground">{isArabic ? "كتالوج الأدوار" : "Role catalog"}</h2></div>
        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => (
            <div key={role.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-semibold text-foreground">{role.name}</p><p className="mt-0.5 text-xs font-mono text-muted-foreground">{role.code}</p></div>
                <Badge variant={role.isSystem ? "secondary" : "outline"}>{role.isSystem ? "System" : "Custom"}</Badge>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{role.permissions.length} {isArabic ? "صلاحية" : "permissions"} · {role._count.assignments} {isArabic ? "تعيين" : "assignments"}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {role.permissions.slice(0, 6).map((permission) => <span key={permission.id} className="rounded bg-muted px-1.5 py-1 text-[10px] text-muted-foreground">{permission.permissionKey}</span>)}
                {role.permissions.length > 6 ? <span className="px-1.5 py-1 text-[10px] text-muted-foreground">+{role.permissions.length - 6}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
