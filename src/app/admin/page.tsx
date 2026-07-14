/**
 * /admin — Phase 2 placeholder. Protected by middleware (platform sessions only).
 *
 * Phase 1: shows the authenticated super-admin a clear "Phase 2" notice with quick stats
 * (counts of platform users, tenants, plans, leads) so we can prove the data layer works.
 */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, FileBarChart, Layers, Hourglass, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/ui-empty/EmptyState";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const session = await getSession();
  // Middleware already enforces platform-only access. We re-check here as defense in depth.
  if (!session || session.kind !== "platform") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <EmptyState
          title="Access denied"
          description="You need a platform (Super Admin) account to access this page."
          icon={ShieldCheck}
        />
      </div>
    );
  }

  const [tenantCount, planCount, leadCount, platformUserCount, pendingTenants, recentLeads] = await Promise.all([
    db.tenant.count(),
    db.plan.count({ where: { isActive: true } }),
    db.lead.count(),
    db.platformUser.count({ where: { status: "ACTIVE" } }),
    db.tenant.count({ where: { status: "PENDING_ACTIVATION" } }),
    db.lead.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { assignedTo: true } }),
  ]);

  const stats = [
    { label: "Total companies", value: tenantCount, icon: Building2 },
    { label: "Pending activation", value: pendingTenants, icon: Hourglass },
    { label: "Active plans", value: planCount, icon: Layers },
    { label: "Platform users", value: platformUserCount, icon: Users },
    { label: "Total leads", value: leadCount, icon: FileBarChart },
  ];

  return (
    <AppShell
      session={{
        name: session.name,
        email: session.email,
        role: session.role,
        kind: "platform",
      }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-lg border border-brand-accent/30 bg-brand-accent/5 p-4">
          <div className="flex items-start gap-3">
            <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-brand-accent" />
            <div>
              <p className="text-sm font-semibold text-foreground">Phase 2 — Super Admin control center is coming</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                This page is a Phase 1 placeholder. Phase 2 will add full tenant management, plan
                editing, invoice creation, payment recording, lead follow-up, audit log, and
                impersonation. The stats below prove the data layer is wired correctly.
              </p>
            </div>
          </div>
        </div>

        <h1 className="text-lg font-bold text-foreground">Platform overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{session.email}</span> ({session.role.replace(/_/g, " ")}).
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-medium text-muted-foreground">{s.label}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-foreground">{s.value.toLocaleString()}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-semibold text-foreground">Recent leads</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Phase 2 will add a full leads board with assignment, status workflow, and conversion to tenants.
          </p>

          <div className="mt-4 rounded-lg border border-border bg-card">
            {recentLeads.length === 0 ? (
              <EmptyState title="No leads yet" description="Leads from /contact and /request-demo will appear here." />
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Name</th>
                    <th className="px-4 py-2.5 text-left font-medium">Company</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">Source</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium sm:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.map((l) => (
                    <tr key={l.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-foreground">{l.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{l.company ?? "—"}</td>
                      <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">{l.sourcePage.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={
                          l.status === "NEW" ? "border-amber-300 text-amber-800" :
                          l.status === "CONTACTED" ? "border-orange-300 text-orange-800" :
                          l.status === "QUALIFIED" ? "border-brand-navy text-brand-navy" :
                          "border-border text-muted-foreground"
                        }>
                          {l.status}
                        </Badge>
                      </td>
                      <td className="hidden px-4 py-2.5 text-xs text-muted-foreground sm:table-cell">
                        {new Date(l.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground">Phase 2 preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-xs text-muted-foreground">
              <p>• Full tenant activation workflow</p>
              <p>• Plan editing and feature flag UI</p>
              <p>• Invoice creation + payment recording</p>
              <p>• Subscription status management</p>
              <p>• Lead board with assignment</p>
              <p>• Platform audit log viewer</p>
              <p>• Impersonation with reason + audit</p>
              <p>• Support ticket queue</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground">Quick links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Link href="/" className="block text-brand-accent hover:underline">← Back to marketing site</Link>
              <Link href="/login" className="block text-brand-accent hover:underline">Switch account</Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
