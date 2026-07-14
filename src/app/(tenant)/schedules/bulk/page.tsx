/** /schedules/bulk */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BulkScheduleForm } from "./BulkScheduleForm";

export const dynamic = "force-dynamic";

export default async function BulkSchedulePage() {
  const session = await getSession();
  if (!session?.tenantId) return null;
  const [branches, employees, policies] = await Promise.all([
    db.branch.findMany({ where: { companyId: session.tenantId, deletedAt: null } }),
    db.employee.findMany({ where: { companyId: session.tenantId, deletedAt: null }, orderBy: { fullName: "asc" } }),
    db.shiftPolicy.findMany({ where: { companyId: session.tenantId } }),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/schedules" className="text-xs text-muted-foreground hover:text-foreground">← Schedules</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">Bulk schedule generation</h1>
        <p className="text-sm text-muted-foreground">Generate schedules across a date range for multiple employees. Weekends are skipped by default. Duplicate employee/date schedules are skipped.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold text-foreground">Generate</CardTitle></CardHeader>
        <CardContent><BulkScheduleForm branches={branches} employees={employees} policies={policies} /></CardContent>
      </Card>
    </div>
  );
}
