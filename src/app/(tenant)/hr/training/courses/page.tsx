import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { GraduationCap, Plus, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function CoursesPage({ searchParams }: { searchParams: Promise<{ category?: string; active?: string }> }) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const tid = session.tenantId;
  const params = await searchParams;
  const canManage = hasPerm(session.role, "MANAGE_TRAINING");

  const where: any = { companyId: tid };
  if (params.category) where.category = params.category;
  if (params.active !== undefined && params.active !== "") where.active = params.active === "true";

  const courses = await db.trainingCourse.findMany({ where, orderBy: { createdAt: "desc" } });

  const totalCourses = await db.trainingCourse.count({ where: { companyId: tid } });
  const activeCourses = await db.trainingCourse.count({ where: { companyId: tid, active: true } });
  const inactiveCourses = totalCourses - activeCourses;

  const categoryLabel = (cat: string) => cat.replace(/_/g, " ");

  const categories = ["FOOD_SAFETY", "CUSTOMER_SERVICE", "CASHIER", "KITCHEN", "CLEANLINESS", "SAFETY", "ONBOARDING", "MANAGEMENT", "OTHER"];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Training Courses</h1>
          <p className="text-sm text-muted-foreground">{totalCourses} total · {activeCourses} active · {inactiveCourses} inactive</p>
        </div>
        {canManage && (
          <Link href="/hr/training/courses/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90">
            <Plus className="h-3.5 w-3.5" /> New Course
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{totalCourses}</p>
          <p className="text-xs text-muted-foreground">Total courses</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{activeCourses}</p>
          <p className="text-xs text-muted-foreground">Active courses</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{inactiveCourses}</p>
          <p className="text-xs text-muted-foreground">Inactive courses</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/hr/training/courses" className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium ${!params.category && params.active === undefined ? "bg-brand-accent text-white" : "border border-border bg-card text-foreground hover:bg-muted/40"}`}>
          All
        </Link>
        {categories.map((cat) => (
          <Link key={cat} href={`/hr/training/courses?category=${cat}`} className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium ${params.category === cat ? "bg-brand-accent text-white" : "border border-border bg-card text-foreground hover:bg-muted/40"}`}>
            {categoryLabel(cat)}
          </Link>
        ))}
        <Link href="/hr/training/courses?active=true" className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium ${params.active === "true" ? "bg-brand-accent text-white" : "border border-border bg-card text-foreground hover:bg-muted/40"}`}>
          Active
        </Link>
        <Link href="/hr/training/courses?active=false" className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium ${params.active === "false" ? "bg-brand-accent text-white" : "border border-border bg-card text-foreground hover:bg-muted/40"}`}>
          Inactive
        </Link>
      </div>

      <Card className="border-border">
        {courses.length === 0 ? (
          <EmptyState title="No training courses" description="Create your first training course" icon={GraduationCap} />
        ) : (
          <div className="divide-y divide-border/60">
            {courses.map((c) => (
              <Link key={c.id} href={`/hr/training/courses/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {categoryLabel(c.category)}
                      {c.requiredForJobTitle ? ` · Required for ${c.requiredForJobTitle}` : ""}
                      {c.validityMonths ? ` · ${c.validityMonths} months validity` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.active ? "default" : "outline"} className="text-[10px]">{c.active ? "Active" : "Inactive"}</Badge>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
