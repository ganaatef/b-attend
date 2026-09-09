"use client";

import { useMemo, useState, useActionState } from "react";
import { Copy, Plus, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { PERMISSION_GROUPS } from "@/lib/auth/permission-catalog";
import { createCustomRoleAction, inviteUserAction } from "./actions";

type Option = { id: string; name: string };
type RoleOption = Option & { code: string; isSystem: boolean };
type EmployeeOption = { id: string; fullName: string; employeeCode: string; email: string | null };

type InviteState = { ok: boolean; error?: string; emailSent?: boolean; invitationUrl?: string };
type RoleState = { ok: boolean; error?: string };

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus:ring-2 focus:ring-ring";

export function AccessClient({
  roles,
  employees,
  branches,
  departments,
  canInvite,
  canManageRoles,
  isArabic,
}: {
  roles: RoleOption[];
  employees: EmployeeOption[];
  branches: Option[];
  departments: Option[];
  canInvite: boolean;
  canManageRoles: boolean;
  isArabic: boolean;
}) {
  const [scopeType, setScopeType] = useState("TENANT");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [inviteState, inviteFormAction, invitePending] = useActionState<InviteState, FormData>(inviteUserAction, { ok: false });
  const [roleState, roleFormAction, rolePending] = useActionState<RoleState, FormData>(createCustomRoleAction, { ok: false });

  const scopeOptions = useMemo(() => {
    if (scopeType === "BRANCH") return branches;
    if (scopeType === "DEPARTMENT") return departments;
    return [];
  }, [scopeType, branches, departments]);

  function togglePermission(permission: string, checked: boolean) {
    setSelectedPermissions((current) => checked
      ? [...new Set([...current, permission])]
      : current.filter((item) => item !== permission));
  }

  async function copyInvitationLink() {
    if (!inviteState.invitationUrl) return;
    await navigator.clipboard.writeText(inviteState.invitationUrl);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><Send className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold text-foreground">{isArabic ? "دعوة مستخدم" : "Invite a user"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isArabic ? "اربط حساب الدخول بسجل موظف عند الحاجة، وحدد الدور ونطاق الوصول" : "Optionally link the login to an employee record, then assign a role and access scope."}
            </p>
          </div>
        </div>

        {!canInvite ? (
          <Alert><AlertDescription>{isArabic ? "ليس لديك صلاحية إرسال دعوات" : "You do not have permission to send invitations."}</AlertDescription></Alert>
        ) : (
          <form action={inviteFormAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invite-name">{isArabic ? "الاسم" : "Name"}</Label>
                <Input id="invite-name" name="name" required minLength={2} maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">{isArabic ? "البريد الإلكتروني" : "Email"}</Label>
                <Input id="invite-email" name="email" type="email" required autoComplete="email" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employeeId">{isArabic ? "ربط بموظف — اختياري" : "Link to employee — optional"}</Label>
              <select id="employeeId" name="employeeId" className={selectClass} defaultValue="">
                <option value="">{isArabic ? "بدون ربط" : "No employee link"}</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.employeeCode} — {employee.fullName}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="roleId">{isArabic ? "الدور" : "Role"}</Label>
                <select id="roleId" name="roleId" className={selectClass} required defaultValue="">
                  <option value="" disabled>{isArabic ? "اختر الدور" : "Select role"}</option>
                  {roles.filter((role) => role.code !== "OWNER").map((role) => (
                    <option key={role.id} value={role.id}>{role.name}{role.isSystem ? " · System" : ""}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scopeType">{isArabic ? "نطاق الصلاحية" : "Access scope"}</Label>
                <select
                  id="scopeType"
                  name="scopeType"
                  className={selectClass}
                  value={scopeType}
                  onChange={(event) => setScopeType(event.target.value)}
                >
                  <option value="TENANT">{isArabic ? "الشركة بالكامل" : "Entire company"}</option>
                  <option value="BRANCH">{isArabic ? "فرع محدد" : "Specific branch"}</option>
                  <option value="DEPARTMENT">{isArabic ? "قسم محدد" : "Specific department"}</option>
                  <option value="SELF">{isArabic ? "نفسه فقط" : "Self only"}</option>
                </select>
              </div>
            </div>

            {scopeOptions.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="scopeId">{scopeType === "BRANCH" ? (isArabic ? "الفرع" : "Branch") : (isArabic ? "القسم" : "Department")}</Label>
                <select id="scopeId" name="scopeId" className={selectClass} required defaultValue="">
                  <option value="" disabled>{isArabic ? "اختر النطاق" : "Select scope"}</option>
                  {scopeOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </div>
            ) : null}

            {inviteState.error ? <Alert variant="destructive"><AlertDescription>{inviteState.error}</AlertDescription></Alert> : null}
            {inviteState.ok ? (
              <Alert>
                <AlertDescription className="space-y-2">
                  <p>{inviteState.emailSent
                    ? (isArabic ? "تم إرسال الدعوة الآمنة بالبريد الإلكتروني" : "Secure invitation sent by email.")
                    : (isArabic ? "تم إنشاء الدعوة. خدمة البريد غير مفعلة، انسخ الرابط وأرسله للمستخدم عبر قناة موثوقة" : "Invitation created. Email delivery is not configured; copy the secure link and send it through a trusted channel.")}</p>
                  {inviteState.invitationUrl ? (
                    <Button type="button" variant="outline" size="sm" onClick={copyInvitationLink}>
                      <Copy className="me-2 h-4 w-4" />{isArabic ? "نسخ رابط الدعوة" : "Copy invitation link"}
                    </Button>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" disabled={invitePending} className="w-full sm:w-auto">
              <Send className="me-2 h-4 w-4" />
              {invitePending ? (isArabic ? "جاري الإرسال..." : "Sending...") : (isArabic ? "إرسال الدعوة" : "Send invitation")}
            </Button>
          </form>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold text-foreground">{isArabic ? "دور مخصص" : "Custom role"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isArabic ? "أنشئ دورًا بصلاحيات دقيقة بدل الاعتماد على مسميات ثابتة" : "Create a least-privilege role instead of relying on fixed job titles."}
            </p>
          </div>
        </div>

        {!canManageRoles ? (
          <Alert><AlertDescription>{isArabic ? "إدارة تعريفات الأدوار متاحة لمالك الشركة" : "Role-definition management is restricted to the company owner."}</AlertDescription></Alert>
        ) : (
          <form action={roleFormAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="role-name">{isArabic ? "اسم الدور" : "Role name"}</Label>
                <Input id="role-name" name="name" required minLength={2} maxLength={80} placeholder={isArabic ? "مثال: مسؤول الرواتب" : "e.g. Payroll Specialist"} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-code">{isArabic ? "رمز الدور" : "Role code"}</Label>
                <Input id="role-code" name="code" required minLength={2} maxLength={48} placeholder="PAYROLL_SPECIALIST" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">{isArabic ? "الوصف — اختياري" : "Description — optional"}</Label>
              <Input id="role-description" name="description" maxLength={300} />
            </div>

            <input type="hidden" name="permissions" value={selectedPermissions.join(",")} />
            <div className="max-h-[390px] space-y-4 overflow-y-auto rounded-lg border border-border p-4">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.key}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.permissions.map((permission) => {
                      const checked = selectedPermissions.includes(permission);
                      return (
                        <label key={permission} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50">
                          <Checkbox checked={checked} onCheckedChange={(value) => togglePermission(permission, value === true)} />
                          <span className="break-all text-foreground">{permission}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {roleState.error ? <Alert variant="destructive"><AlertDescription>{roleState.error}</AlertDescription></Alert> : null}
            {roleState.ok ? <Alert><AlertDescription>{isArabic ? "تم إنشاء الدور المخصص" : "Custom role created."}</AlertDescription></Alert> : null}

            <Button type="submit" disabled={rolePending || selectedPermissions.length === 0} className="w-full sm:w-auto">
              <Plus className="me-2 h-4 w-4" />
              {rolePending ? (isArabic ? "جاري الإنشاء..." : "Creating...") : (isArabic ? "إنشاء الدور" : "Create role")}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
