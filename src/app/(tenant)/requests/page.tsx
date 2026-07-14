/** /requests — employee's own requests + new request form */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { RequestForm } from "./RequestForm";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const session = await getSession();
  if (!session?.tenantId) return null;

  // Find employee for this user
  const user = await db.user.findUnique({ where: { id: session.sub }, include: { employee: true } });
  const employee = user?.employee;

  const requests = employee ? await db.approvalRequest.findMany({
    where: { employeeId: employee.id },
    include: { branch: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  }) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div><h1 className="text-lg font-bold text-foreground">My requests</h1><p className="text-sm text-muted-foreground">Submit and track your attendance requests.</p></div>

      {employee ? (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">New request</CardTitle></CardHeader>
          <CardContent><RequestForm employeeId={employee.id} branchId={employee.branchId ?? undefined} /></CardContent>
        </Card>
      ) : (
        <Card><CardContent className="py-6"><p className="text-center text-sm text-muted-foreground">Your user is not linked to an employee record. Contact HR.</p></CardContent></Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Recent requests</CardTitle></CardHeader>
        <CardContent>
          {requests.length === 0 ? <EmptyState title="No requests yet" /> : (
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{r.type.replace(/_/g, " ")}</span>
                    <Badge variant={r.status === "PENDING" ? "secondary" : r.status === "APPROVED" ? "default" : r.status === "REJECTED" ? "destructive" : "outline"} className={r.status === "PENDING" ? "bg-amber-100 text-amber-800 border-transparent text-xs" : r.status === "APPROVED" ? "bg-brand-success text-white border-transparent text-xs" : "text-xs"}>{r.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                  {r.date && <p className="text-xs text-muted-foreground">For: {new Date(r.date).toLocaleDateString()}</p>}
                  {r.managerNotes && <p className="mt-1 text-xs text-foreground">Manager: {r.managerNotes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
