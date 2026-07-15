/** /hr/job-titles — Job Title CRUD with safe delete */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { hasHrPermission } from "@/lib/hr/permissions";
import { createJobTitleAction, deleteJobTitleAction } from "../actions";
import { Trash2, Award, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HrJobTitlesPage() {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const tid = session.tenantId;

  const featureCheck = await canUseHrFeature(tid, "hr_core");
  if (!featureCheck.allowed) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Card className="border-dashed border-amber-300 bg-amber-50/40">
          <div className="pt-6 pb-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-amber-500" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">HR Module requires Growth plan or higher</h3>
            <p className="mt-1 text-xs text-muted-foreground">{featureCheck.reason ?? "Upgrade to access HR features."}</p>
          </div>
        </Card>
      </div>
    );
  }

  const canManage = await hasHrPermission("MANAGE_JOB_TITLES");
  if (!canManage) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Card className="border-dashed border-destructive/40">
          <div className="pt-6 pb-6 text-center">
            <h3 className="text-sm font-semibold text-foreground">Access Denied</h3>
            <p className="mt-1 text-xs text-muted-foreground">You do not have permission to manage job titles.</p>
          </div>
        </Card>
      </div>
    );
  }

  const [jobTitles, departments] = await Promise.all([
    db.jobTitle.findMany({
      where: { companyId: tid },
      include: { department: true, _count: { select: { employees: true } } },
      orderBy: { title: "asc" },
    }),
    db.department.findMany({ where: { companyId: tid, active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">Job Titles</h1>
        <p className="text-sm text-muted-foreground">{jobTitles.length} job titles</p>
      </div>

      <Card className="border-border p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Add job title</h2>
        <form action={async (formData: FormData) => { "use server"; await createJobTitleAction({}, formData); }} className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="title" className="sr-only">Title</Label>
            <Input id="title" name="title" required placeholder="e.g. Waiter" />
          </div>
          <div className="w-48">
            <Label htmlFor="departmentId" className="sr-only">Department</Label>
            <select id="departmentId" name="departmentId" className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm">
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="w-24">
            <Label htmlFor="grade" className="sr-only">Grade</Label>
            <Input id="grade" name="grade" placeholder="L3" />
          </div>
          <Button type="submit" size="sm">Add</Button>
        </form>
      </Card>

      <Card className="border-border">
        {jobTitles.length === 0 ? (
          <EmptyState title="No job titles" icon={Award} />
        ) : (
          <div className="divide-y divide-border/60">
            {jobTitles.map((jt) => (
              <div key={jt.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium text-foreground">{jt.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {jt.department?.name ?? "No department"} · {jt.grade ?? "—"} · {jt._count.employees} employees
                    </p>
                  </div>
                  {!jt.active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                </div>
                <form action={async () => {
                  "use server";
                  const result = await deleteJobTitleAction(jt.id);
                  if (result?.deactivated) {
                    console.log(result.message);
                  }
                }}>
                  <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
