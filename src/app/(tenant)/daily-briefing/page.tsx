/**
 * /daily-briefing — Manager daily briefing to read to staff before shift.
 */
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Sunrise, ListChecks, AlertCircle, Heart } from "lucide-react";
import { generateDailyBriefing } from "@/lib/ai/provider";
import { canUseAiFeature } from "@/lib/ai/feature-gates";

export const dynamic = "force-dynamic";

export default async function DailyBriefingPage() {
  const session = await getSession();
  if (!session?.tenantId) return null;
  if (session.role === "EMPLOYEE") {
    return <div className="p-4 text-sm text-muted-foreground">Daily briefing is for managers, HR, and owners only.</div>;
  }

  const gate = await canUseAiFeature(session.tenantId, "daily_briefing");
  if (!gate.allowed) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="pt-6 text-center">
            <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold text-foreground">Daily Briefing is not available</h2>
            <p className="mt-1 text-sm text-muted-foreground">{gate.reason}</p>
            <Link href="/billing" className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              View plans
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Branch scoping
  let branchName: string | undefined;
  let teamSize = 0;
  if (session.role === "BRANCH_MANAGER") {
    const user = await db.user.findUnique({ where: { id: session.sub } });
    const branches = await db.branch.findMany({ where: { companyId: session.tenantId, managerId: user?.id, deletedAt: null } });
    if (branches.length > 0) {
      branchName = branches[0].name;
      teamSize = await db.employee.count({ where: { branchId: branches[0].id, deletedAt: null, status: "ACTIVE" } });
    }
  } else {
    teamSize = await db.employee.count({ where: { companyId: session.tenantId, deletedAt: null, status: "ACTIVE" } });
  }

  const briefing = await generateDailyBriefing(
    { companyId: session.tenantId, userId: session.sub, feature: "daily_briefing" },
    { branchName, teamSize, avgScore: 0 },
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">Daily Briefing</h1>
        <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}{branchName ? ` · ${branchName}` : ""}</p>
      </div>

      <Card className="border-brand-accent/30 bg-gradient-to-br from-brand-accent/5 to-brand-navy/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sunrise className="h-4 w-4 text-brand-accent" />
            <CardTitle className="text-sm font-semibold text-foreground">Today&apos;s focus theme</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Badge variant="outline" className="bg-brand-accent/10 text-brand-navy border-transparent">{briefing.theme.replace(/_/g, " ").toLowerCase()}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-brand-accent" />
            <CardTitle className="text-sm font-semibold text-foreground">3 talking points</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {briefing.talkingPoints.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-accent/10 text-xs font-semibold text-brand-accent">{i + 1}</span>
                <span className="text-foreground/90">{p}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="border-amber-300 bg-amber-50/40">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-sm font-semibold text-foreground">Operational reminder</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground/90">{briefing.operationalReminder}</p>
        </CardContent>
      </Card>

      <Card className="border-brand-success/30 bg-brand-success/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-brand-success" />
            <CardTitle className="text-sm font-semibold text-foreground">Motivation paragraph</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground/90">{briefing.motivation}</p>
        </CardContent>
      </Card>

      {briefing.branchNote && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Branch note</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/90">{briefing.branchNote}</p>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-dashed border-border bg-card/40 p-4 text-center">
        <p className="text-xs text-muted-foreground">Read this briefing to your team at the start of the shift. Keep it under 2 minutes — short, clear, supportive.</p>
      </div>
    </div>
  );
}
