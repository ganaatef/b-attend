/** /profile — current user profile + linked employee info */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User as UserIcon } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session?.tenantId) return null;
  const user = await db.user.findUnique({ where: { id: session.sub }, include: { employee: { include: { branch: true, department: true } } } });
  if (!user) return null;
  const tenant = await db.tenant.findUnique({ where: { id: session.tenantId } });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div><h1 className="text-lg font-bold text-foreground">My profile</h1><p className="text-sm text-muted-foreground">Your account and employee details.</p></div>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Account</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Name:</span> <span className="font-medium text-foreground">{user.name}</span></div>
          <div><span className="text-muted-foreground">Email:</span> <span className="font-medium text-foreground">{user.email}</span></div>
          <div><span className="text-muted-foreground">Role:</span> <Badge variant="outline" className="text-xs">{user.role.replace(/_/g, " ")}</Badge></div>
          <div><span className="text-muted-foreground">Status:</span> <Badge variant={user.status === "ACTIVE" ? "default" : "destructive"} className={user.status === "ACTIVE" ? "bg-brand-success text-white border-transparent text-xs" : "text-xs"}>{user.status}</Badge></div>
          <div><span className="text-muted-foreground">Company:</span> <span className="font-medium text-foreground">{tenant?.name}</span></div>
          <div><span className="text-muted-foreground">Last login:</span> <span className="text-foreground">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}</span></div>
        </CardContent>
      </Card>
      {user.employee && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Employee record</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Code:</span> <span className="font-medium text-foreground">{user.employee.employeeCode}</span></div>
            <div><span className="text-muted-foreground">Job title:</span> <span className="font-medium text-foreground">{user.employee.jobTitle ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Branch:</span> <span className="font-medium text-foreground">{user.employee.branch?.name ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Department:</span> <span className="font-medium text-foreground">{user.employee.department?.name ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium text-foreground">{user.employee.phone ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Employment type:</span> <span className="font-medium text-foreground">{user.employee.employmentType.replace(/_/g, " ")}</span></div>
            <div><span className="text-muted-foreground">Start date:</span> <span className="font-medium text-foreground">{user.employee.startDate ? new Date(user.employee.startDate).toLocaleDateString() : "—"}</span></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
