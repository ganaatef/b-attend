/** /hr/leaves — Leave Management dashboard with tabs: Requests, Balances, Types */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { hasHrPermission, getManagedBranchIds } from "@/lib/hr/permissions";
import { approveLeaveRequestAction, rejectLeaveRequestAction, cancelLeaveRequestAction, createLeaveTypeAction, deleteLeaveTypeAction } from "../actions";
import { CalendarDays, Download, Lock, Plus, CheckCircle2, XCircle, Clock, Trash2, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HrLeavesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;
  const tid = session.tenantId;
  const { tab } = await searchParams;

  const featureCheck = await canUseHrFeature(tid, "hr_leave");
  if (!featureCheck.allowed) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Card className="border-dashed border-amber-300 bg-amber-50/40">
          <div className="pt-6 pb-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-amber-500" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">Leave Management requires Starter plan or higher</h3>
            <p className="mt-1 text-xs text-muted-foreground">{featureCheck.reason ?? "Upgrade to access leave management."}</p>
          </div>
        </Card>
      </div>
    );
  }

  const canApprove = await hasHrPermission("APPROVE_LEAVE");
  const canManageTypes = await hasHrPermission("MANAGE_LEAVE_TYPES");
  const canExport = await hasHrPermission("EXPORT_HR_EXCEL");
  const isBranchManager = session.role === "BRANCH_MANAGER";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, tid) : [];

  const isOwnerOrHr = session.role === "COMPANY_OWNER" || session.role === "HR_ADMIN";

  const branchFilter = isBranchManager && managedBranchIds.length > 0
    ? { employee: { branchId: { in: managedBranchIds } } }
    : {};

  const [leaveRequests, leaveTypes, leaveBalances] = await Promise.all([
    db.leaveRequest.findMany({
      where: { companyId: tid, ...branchFilter },
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true, branch: { select: { name: true } } } },
        leaveType: { select: { name: true, code: true, paid: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.leaveType.findMany({ where: { companyId: tid }, orderBy: { name: "asc" } }),
    db.leaveBalance.findMany({
      where: { companyId: tid, year: new Date().getFullYear(), ...branchFilter },
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true } },
        leaveType: { select: { name: true, code: true } },
      },
      orderBy: { employee: { fullName: "asc" } },
    }),
  ]);

  const pendingCount = leaveRequests.filter((r) => r.status === "PENDING").length;
  const approvedCount = leaveRequests.filter((r) => r.status === "APPROVED").length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const onLeaveToday = await db.attendanceDay.count({ where: { companyId: tid, date: todayStart, status: "LEAVE", ...(isBranchManager && managedBranchIds.length > 0 ? { branchId: { in: managedBranchIds } } : {}) } });

  const requestStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED": return "bg-brand-success text-white border-transparent";
      case "REJECTED": return "bg-destructive/10 text-destructive border-destructive/20";
      case "PENDING": return "bg-amber-50 text-amber-600 border-amber-200";
      case "CANCELLED": return "bg-muted text-muted-foreground border-border";
      default: return "";
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Leave Management</h1>
          <p className="text-sm text-muted-foreground">{pendingCount} pending requests · {onLeaveToday} on leave today</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <Link href="/api/tenant/hr/leaves/excel" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40">
              <Download className="h-3.5 w-3.5" /> Export Excel
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">Pending requests</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{approvedCount}</p>
          <p className="text-xs text-muted-foreground">Approved (all time)</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{onLeaveToday}</p>
          <p className="text-xs text-muted-foreground">On leave today</p>
        </Card>
        <Card className="border-border p-4">
          <p className="text-2xl font-bold text-foreground">{leaveTypes.filter((lt) => lt.active).length}</p>
          <p className="text-xs text-muted-foreground">Active leave types</p>
        </Card>
      </div>

      <Tabs defaultValue={tab || "requests"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          {isOwnerOrHr && <TabsTrigger value="types">Leave Types</TabsTrigger>}
        </TabsList>

        <TabsContent value="requests">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">Leave Requests</CardTitle>
                <Link href="/hr/leaves/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-accent/90">
                  <Plus className="h-3.5 w-3.5" /> New Request
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {leaveRequests.length === 0 ? (
                <EmptyState title="No leave requests" icon={CalendarDays} />
              ) : (
                <div className="divide-y divide-border/60">
                  {leaveRequests.map((lr) => (
                    <div key={lr.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{lr.employee.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {lr.leaveType.name} · {new Date(lr.startDate).toLocaleDateString()} — {new Date(lr.endDate).toLocaleDateString()} · {lr.daysCount} day{lr.daysCount > 1 ? "s" : ""}
                          </p>
                          {lr.reason && <p className="text-[10px] text-muted-foreground truncate max-w-[300px]">{lr.reason}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={lr.status === "APPROVED" ? "default" : "outline"} className={`text-[10px] ${requestStatusColor(lr.status)}`}>{lr.status}</Badge>
                        {canApprove && lr.status === "PENDING" && (
                          <div className="flex gap-1">
                            <form action={async () => { "use server"; await approveLeaveRequestAction(lr.id); }}>
                              <button type="submit" className="inline-flex items-center gap-1 rounded-md bg-brand-success px-2 py-1 text-[10px] font-medium text-white hover:bg-brand-success/90">
                                <CheckCircle2 className="h-3 w-3" /> Approve
                              </button>
                            </form>
                            <form action={async () => { "use server"; await rejectLeaveRequestAction(lr.id); }}>
                              <button type="submit" className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-[10px] font-medium text-destructive hover:bg-destructive/5">
                                <XCircle className="h-3 w-3" /> Reject
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances">
          <Card className="border-border">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Leave Balances ({new Date().getFullYear()})</CardTitle></CardHeader>
            <CardContent>
              {leaveBalances.length === 0 ? (
                <EmptyState title="No leave balances" icon={CalendarDays} />
              ) : (
                <div className="divide-y divide-border/60">
                  {leaveBalances.map((lb) => (
                    <div key={lb.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">{lb.employee.fullName} ({lb.employee.employeeCode})</p>
                        <p className="text-xs text-muted-foreground">{lb.leaveType.name} ({lb.leaveType.code})</p>
                      </div>
                      <div className="text-right text-xs">
                        <p className="font-medium text-foreground">{lb.remaining}/{lb.openingBalance + lb.accrued} remaining</p>
                        <p className="text-muted-foreground">Used: {lb.used} · Pending: {lb.pending}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isOwnerOrHr && (
          <TabsContent value="types">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">Leave Types</CardTitle>
              </CardHeader>
              <CardContent>
                {canManageTypes && (
                  <Card className="border-border p-4 mb-4">
                    <h3 className="mb-3 text-xs font-semibold text-foreground">Add Leave Type</h3>
                    <form action={async (formData: FormData) => { "use server"; await createLeaveTypeAction({}, formData); }} className="flex flex-wrap gap-2 items-end">
                      <div className="flex-1 min-w-[120px]">
                        <Label htmlFor="lt-name" className="sr-only">Name</Label>
                        <Input id="lt-name" name="name" required placeholder="Name (e.g. Annual Leave)" className="h-8 text-xs" />
                      </div>
                      <div className="w-24">
                        <Label htmlFor="lt-code" className="sr-only">Code</Label>
                        <Input id="lt-code" name="code" required placeholder="Code" className="h-8 text-xs" />
                      </div>
                      <div className="w-32">
                        <Label htmlFor="lt-days" className="sr-only">Days</Label>
                        <Input id="lt-days" name="annualAllowanceDays" type="number" min="0" defaultValue="0" className="h-8 text-xs" />
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input type="checkbox" name="paid" defaultChecked className="h-3.5 w-3.5" /> Paid
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input type="checkbox" name="requiresApproval" defaultChecked className="h-3.5 w-3.5" /> Requires approval
                      </label>
                      <Button type="submit" size="sm" className="h-8">Add</Button>
                    </form>
                  </Card>
                )}

                {leaveTypes.length === 0 ? (
                  <EmptyState title="No leave types" icon={CalendarDays} />
                ) : (
                  <div className="divide-y divide-border/60">
                    {leaveTypes.map((lt) => (
                      <div key={lt.id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{lt.name} <span className="text-xs text-muted-foreground">({lt.code})</span></p>
                          <p className="text-xs text-muted-foreground">
                            {lt.annualAllowanceDays} days/yr · {lt.paid ? "Paid" : "Unpaid"} · {lt.requiresApproval ? "Requires approval" : "Auto-approve"} · {lt.carryForwardAllowed ? "Carry forward" : "No carry forward"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!lt.active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                          {canManageTypes && (
                            <form action={async () => { "use server"; await deleteLeaveTypeAction(lt.id); }}>
                              <button type="submit" className="inline-flex items-center rounded-md p-1 text-destructive hover:bg-destructive/5">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
