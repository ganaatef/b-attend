"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { updateSettingsAction } from "@/app/admin/actions";
import type { Plan, SystemSetting } from "@prisma/client";
import { Loader2 } from "lucide-react";

export function SettingsForm({ settings, plans }: { settings: SystemSetting & { defaultPlan?: Plan | null }; plans: Plan[] }) {
  const [state, formAction] = useActionState(updateSettingsAction, { ok: false });
  const { pending } = useFormStatus();

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="defaultTrialDays">Default trial days</Label>
          <Input id="defaultTrialDays" name="defaultTrialDays" type="number" min={1} max={90} defaultValue={settings.defaultTrialDays} required />
        </div>
        <div>
          <Label htmlFor="defaultGracePeriodDays">Default grace period (days)</Label>
          <Input id="defaultGracePeriodDays" name="defaultGracePeriodDays" type="number" min={1} max={60} defaultValue={settings.defaultGracePeriodDays} required />
        </div>
        <div>
          <Label htmlFor="defaultCurrency">Default currency</Label>
          <Input id="defaultCurrency" name="defaultCurrency" defaultValue={settings.defaultCurrency} required />
        </div>
        <div>
          <Label htmlFor="defaultPlanId">Default plan</Label>
          <Select name="defaultPlanId" defaultValue={settings.defaultPlanId ?? undefined}>
            <SelectTrigger id="defaultPlanId"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="paymentProviderMode">Payment provider</Label>
          <Select name="paymentProviderMode" defaultValue={settings.paymentProviderMode}>
            <SelectTrigger id="paymentProviderMode"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="MANUAL">Manual</SelectItem>
              <SelectItem value="STRIPE">Stripe (placeholder)</SelectItem>
              <SelectItem value="PAYMOB">Paymob (placeholder)</SelectItem>
              <SelectItem value="FAWRY">Fawry (placeholder)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="supportEmail">Support email</Label>
          <Input id="supportEmail" name="supportEmail" type="email" defaultValue={settings.supportEmail} required />
        </div>
        <div>
          <Label htmlFor="billingEmail">Billing email</Label>
          <Input id="billingEmail" name="billingEmail" type="email" defaultValue={settings.billingEmail} required />
        </div>
      </div>
      <div className="flex items-center gap-6 pt-2">
        <div className="flex items-center gap-2">
          <Checkbox id="manualActivationMode" name="manualActivationMode" value="true" defaultChecked={settings.manualActivationMode} />
          <Label htmlFor="manualActivationMode" className="text-sm">Manual activation mode</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="maintenanceMode" name="maintenanceMode" value="true" defaultChecked={settings.maintenanceMode} />
          <Label htmlFor="maintenanceMode" className="text-sm">Maintenance mode</Label>
        </div>
      </div>
      {state && !state.ok && state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      {state && state.ok ? <p className="text-xs text-brand-success">Settings saved.</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...</> : "Save settings"}
      </Button>
    </form>
  );
}
