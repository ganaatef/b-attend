"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { changePlanAction } from "@/app/admin/actions";
import type { Plan } from "@prisma/client";
import { Loader2 } from "lucide-react";

export function ChangePlanForm({ tenantId, currentPlanId, currentCycle, plans }: { tenantId: string; currentPlanId: string; currentCycle: string; plans?: Plan[] }) {
  // Plans loaded server-side via fetch on demand — for simplicity we use a fetch in useEffect.
  // To keep this self-contained and server-friendly, we accept plans via prop OR fall back to a fetch.
  const [state, formAction] = useActionState(changePlanAction, { ok: false });
  const { pending } = useFormStatus();

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div>
        <Label htmlFor="planId">Plan</Label>
        <PlanSelect name="planId" defaultValue={currentPlanId} />
      </div>
      <div>
        <Label htmlFor="billingCycle">Billing cycle</Label>
        <Select name="billingCycle" defaultValue={currentCycle}>
          <SelectTrigger id="billingCycle"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MONTHLY">Monthly</SelectItem>
            <SelectItem value="ANNUAL">Annual</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {state && !state.ok && state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      {state && state.ok ? <p className="text-xs text-brand-success">Plan updated.</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...</> : "Update plan"}
      </Button>
    </form>
  );
}

function PlanSelect({ name, defaultValue }: { name: string; defaultValue: string }) {
  // We fetch plans at runtime to keep this component reusable
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
      // Mark as controlled client-side; server renders the defaultValue
    >
      <PlanOptions defaultValue={defaultValue} />
    </select>
  );
}

import { useEffect, useState } from "react";

function PlanOptions({ defaultValue }: { defaultValue: string }) {
  const [plans, setPlans] = useState<{ id: string; name: string; priceMonthly: number }[]>([]);
  useEffect(() => {
    fetch("/api/public/plans").then(r => r.json()).then(d => setPlans(d.plans ?? [])).catch(() => {});
  }, []);
  if (plans.length === 0) {
    return <option value={defaultValue}>Loading...</option>;
  }
  return (
    <>
      {plans.map((p) => (
        <option key={p.id} value={p.id}>{p.name} — {p.priceMonthly} EGP/mo</option>
      ))}
    </>
  );
}
