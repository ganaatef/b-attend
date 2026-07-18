/** /onboarding — 7-step wizard. */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingWizard } from "./OnboardingWizard";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) redirect("/login?next=/onboarding");
  if (session.role === "EMPLOYEE") return null;

  const locale = await getLocale();
  const [tenant, settings, branches, departments, policies, employees, schedules] = await Promise.all([
    db.tenant.findUnique({ where: { id: session.tenantId } }),
    db.companySettings.findUnique({ where: { companyId: session.tenantId } }),
    db.branch.findMany({ where: { companyId: session.tenantId, deletedAt: null } }),
    db.department.findMany({ where: { companyId: session.tenantId } }),
    db.shiftPolicy.findMany({ where: { companyId: session.tenantId } }),
    db.employee.findMany({ where: { companyId: session.tenantId, deletedAt: null } }),
    db.schedule.findMany({ where: { companyId: session.tenantId } }),
  ]);

  const steps = [
    { key: "profile", label: "Company profile", done: !!settings },
    { key: "branch", label: "First branch", done: branches.length > 0 },
    { key: "departments", label: "Departments", done: departments.length > 0 },
    { key: "policies", label: "Shift policies", done: policies.length > 0 },
    { key: "employees", label: "Employees", done: employees.length > 0 },
    { key: "schedules", label: "First schedules", done: schedules.length > 0 },
    { key: "review", label: "Review", done: false },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">Welcome, {session.name}</h1>
        <p className="text-sm text-muted-foreground">Let&apos;s set up {locale === "ar" ? (tenant?.nameAr || tenant?.name) : tenant?.name}. You can complete these steps in any order.</p>
      </div>
      <Card>
        <CardContent className="pt-4">
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.key} className="flex items-center gap-3">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${s.done ? "bg-brand-success text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                <span className="text-sm text-foreground">{s.label}</span>
                {s.done && <span className="text-xs text-brand-success">✓ Done</span>}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <OnboardingWizard
        tenant={tenant!}
        settings={settings}
        branches={branches}
        departments={departments}
        policies={policies}
        employees={employees}
      />
    </div>
  );
}
