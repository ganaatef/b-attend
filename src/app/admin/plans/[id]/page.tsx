/** /admin/plans/[id] */
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanEditor } from "./PlanEditor";

export const dynamic = "force-dynamic";

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await db.plan.findUnique({ where: { id }, include: { features: true } });
  if (!plan) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/admin/plans" className="text-xs text-muted-foreground hover:text-foreground">← Plans</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">{plan.name}</h1>
        <p className="text-sm text-muted-foreground">Edit plan limits and feature flags.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold text-foreground">Plan details</CardTitle></CardHeader>
        <CardContent>
          <PlanEditor plan={plan} />
        </CardContent>
      </Card>
    </div>
  );
}
