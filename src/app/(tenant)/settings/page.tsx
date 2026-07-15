/** /settings */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CustomerSettingsForm } from "./CustomerSettingsForm";
import { runMarkAbsentAction } from "./actions";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session?.tenantId) return null;
  if (session.role !== "COMPANY_OWNER" && session.role !== "HR_ADMIN") {
    return <div className="p-4 text-sm text-muted-foreground">Settings are only available to owners and HR admins.</div>;
  }
  const settings = await db.companySettings.findUnique({ where: { companyId: session.tenantId } });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div><h1 className="text-lg font-bold text-foreground">Settings</h1><p className="text-sm text-muted-foreground">Company-wide attendance and operational settings.</p></div>
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold text-foreground">General</CardTitle></CardHeader>
        <CardContent><CustomerSettingsForm settings={settings} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold text-foreground">Maintenance</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50/40 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="flex-1">
              <p className="font-medium text-amber-900">Mark absent for past days</p>
              <p className="text-xs text-amber-800">Finds scheduled shifts in the past where the employee never clocked in and marks them ABSENT. Useful at month-end before payroll.</p>
            </div>
          </div>
          <form action={async (fd) => { "use server"; await runMarkAbsentAction(Number(fd.get("daysBack") ?? 1)); }} className="flex items-center gap-2">
            <input type="number" name="daysBack" min={1} max={90} defaultValue={1} className="h-9 w-24 rounded-md border border-input bg-transparent px-3 text-sm" />
            <Button type="submit" size="sm" variant="outline">Run mark-absent</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
