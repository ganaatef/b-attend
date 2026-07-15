"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updatePlanAction, togglePlanFeatureAction } from "@/app/admin/actions";
import type { Plan, PlanFeature } from "@prisma/client";
import { Loader2, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";

type PlanWithFeatures = Plan & { features: PlanFeature[] };

export function PlanEditor({ plan }: { plan: PlanWithFeatures }) {
  const [state, formAction] = useActionState(updatePlanAction, { ok: false });
  const { pending } = useFormStatus();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="planId" value={plan.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={plan.name} required />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" defaultValue={plan.description ?? ""} />
          </div>
          <div>
            <Label htmlFor="priceMonthly">Monthly price (EGP)</Label>
            <Input id="priceMonthly" name="priceMonthly" type="number" min={0} defaultValue={plan.priceMonthly} required />
          </div>
          <div>
            <Label htmlFor="priceAnnual">Annual price (EGP)</Label>
            <Input id="priceAnnual" name="priceAnnual" type="number" min={0} defaultValue={plan.priceAnnual} required />
          </div>
          <div>
            <Label htmlFor="maxBranches">Max branches</Label>
            <Input id="maxBranches" name="maxBranches" type="number" min={0} defaultValue={plan.maxBranches} required />
          </div>
          <div>
            <Label htmlFor="maxEmployees">Max employees</Label>
            <Input id="maxEmployees" name="maxEmployees" type="number" min={0} defaultValue={plan.maxEmployees} required />
          </div>
          <div>
            <Label htmlFor="maxManagers">Max managers</Label>
            <Input id="maxManagers" name="maxManagers" type="number" min={0} defaultValue={plan.maxManagers} required />
          </div>
          <div>
            <Label htmlFor="maxKiosks">Max kiosks</Label>
            <Input id="maxKiosks" name="maxKiosks" type="number" min={0} defaultValue={plan.maxKiosks} required />
          </div>
          <div>
            <Label htmlFor="auditRetentionDays">Audit retention (days)</Label>
            <Input id="auditRetentionDays" name="auditRetentionDays" type="number" min={1} defaultValue={plan.auditRetentionDays} required />
          </div>
          <div>
            <Label htmlFor="reportsLevel">Reports level</Label>
            <Select name="reportsLevel" defaultValue={plan.reportsLevel}>
              <SelectTrigger id="reportsLevel"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BASIC">Basic</SelectItem>
                <SelectItem value="ADVANCED">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="supportLevel">Support level</Label>
            <Select name="supportLevel" defaultValue={plan.supportLevel}>
              <SelectTrigger id="supportLevel"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SELF_SERVICE">Self-service</SelectItem>
                <SelectItem value="STANDARD">Standard</SelectItem>
                <SelectItem value="PRIORITY">Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="isActive">Active</Label>
            <Select name="isActive" defaultValue={plan.isActive ? "true" : "false"}>
              <SelectTrigger id="isActive"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {state && !state.ok && state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
        {state && state.ok ? <p className="text-xs text-brand-success">Plan updated.</p> : null}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...</> : "Save changes"}
        </Button>
      </form>

      <div>
        <h3 className="text-sm font-semibold text-foreground">Feature flags</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Toggle which features this plan unlocks.</p>
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {plan.features.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={async () => {
                await togglePlanFeatureAction(plan.id, f.key, !f.enabled);
                router.refresh();
              }}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs ${f.enabled ? "border-brand-success/40 bg-brand-success/5" : "border-border bg-card"}`}
            >
              <span className="font-medium text-foreground">{f.label}</span>
              {f.enabled ? <Check className="h-3.5 w-3.5 text-brand-success" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
