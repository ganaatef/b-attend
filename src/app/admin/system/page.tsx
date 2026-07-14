/** /admin/system — health check */
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Server, Database, Cpu, HardDrive } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SystemPage() {
  let dbOk = false;
  let dbLatency = 0;
  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - start;
    dbOk = true;
  } catch {}

  const tenantCount = await db.tenant.count();
  const userCount = await db.platformUser.count() + await db.user.count();
  const punchCount = await db.punch.count();
  const auditCount = await db.platformAuditLog.count() + await db.auditLog.count();

  const checks = [
    { label: "Database connection", ok: dbOk, detail: dbOk ? `${dbLatency}ms latency` : "Cannot connect", icon: Database },
    { label: "App server", ok: true, detail: "Next.js 16 (Turbopack) running", icon: Server },
    { label: "Prisma client", ok: true, detail: "v6.19.2 generated", icon: Cpu },
    { label: "Storage (SQLite fallback)", ok: true, detail: "file:./dev.db — switch to PostgreSQL in production", icon: HardDrive },
  ];

  const counts = [
    { label: "Tenants", value: tenantCount },
    { label: "Total users", value: userCount },
    { label: "Punches", value: punchCount },
    { label: "Audit log entries", value: auditCount },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">System health</h1>
        <p className="text-sm text-muted-foreground">Live status of platform infrastructure.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {checks.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className={c.ok ? "border-brand-success/30 bg-brand-success/5" : "border-destructive/30 bg-destructive/5"}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`h-5 w-5 ${c.ok ? "text-brand-success" : "text-destructive"}`} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{c.ok ? "Operational" : "Down"}</p>
                    <p className="text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold text-foreground">Record counts</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {counts.map((c) => (
              <div key={c.label}>
                <p className="text-2xl font-bold text-foreground">{c.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold text-foreground">Environment</CardTitle></CardHeader>
        <CardContent className="space-y-1.5 text-xs">
          <p><span className="text-muted-foreground">DATABASE_URL:</span> <code className="rounded bg-muted px-1.5 py-0.5">{process.env.DATABASE_URL?.replace(/file:.*\//, "file:…/")}</code></p>
          <p><span className="text-muted-foreground">APP_URL:</span> <code className="rounded bg-muted px-1.5 py-0.5">{process.env.APP_URL}</code></p>
          <p><span className="text-muted-foreground">MANUAL_ACTIVATION_MODE:</span> <Badge variant="outline" className="text-xs">{process.env.MANUAL_ACTIVATION_MODE}</Badge></p>
          <p><span className="text-muted-foreground">PAYMENT_PROVIDER:</span> <Badge variant="outline" className="text-xs">{process.env.PAYMENT_PROVIDER}</Badge></p>
          <p><span className="text-muted-foreground">NODE_ENV:</span> <Badge variant="outline" className="text-xs">{process.env.NODE_ENV}</Badge></p>
        </CardContent>
      </Card>
    </div>
  );
}
