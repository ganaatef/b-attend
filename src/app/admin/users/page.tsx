/** /admin/users — list all platform users + tenant users */
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui-empty/EmptyState";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [platformUsers, tenantUsers] = await Promise.all([
    db.platformUser.findMany({ orderBy: { createdAt: "desc" } }),
    db.user.findMany({ include: { tenant: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground">{platformUsers.length} platform users · {tenantUsers.length} tenant users (latest 100).</p>
      </div>

      <Card className="border-border">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Platform users (Super Admin team)</div>
        {platformUsers.length === 0 ? <EmptyState title="No platform users" icon={Users} /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Name</th>
                <th className="px-4 py-2.5 text-left font-medium">Email</th>
                <th className="px-4 py-2.5 text-left font-medium">Role</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-left font-medium">Last login</th>
              </tr>
            </thead>
            <tbody>
              {platformUsers.map((u) => (
                <tr key={u.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">{u.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{u.role.replace(/_/g, " ")}</Badge></td>
                  <td className="px-4 py-2.5"><Badge variant={u.status === "ACTIVE" ? "default" : "destructive"} className={u.status === "ACTIVE" ? "bg-brand-success text-white border-transparent text-xs" : "text-xs"}>{u.status}</Badge></td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="border-border">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">Tenant users</div>
        {tenantUsers.length === 0 ? <EmptyState title="No tenant users yet" icon={Users} /> : (
          <div className="max-h-[60vh] overflow-y-auto battend-scroll">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-border bg-card text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Name</th>
                  <th className="px-4 py-2.5 text-left font-medium">Email</th>
                  <th className="px-4 py-2.5 text-left font-medium">Tenant</th>
                  <th className="px-4 py-2.5 text-left font-medium">Role</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenantUsers.map((u) => (
                  <tr key={u.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-foreground">{u.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{u.tenant?.name ?? "—"}</td>
                    <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{u.role.replace(/_/g, " ")}</Badge></td>
                    <td className="px-4 py-2.5"><Badge variant={u.status === "ACTIVE" ? "default" : "destructive"} className={u.status === "ACTIVE" ? "bg-brand-success text-white border-transparent text-xs" : "text-xs"}>{u.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
