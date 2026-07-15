"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInvoiceAction } from "@/app/admin/actions";
import { Loader2 } from "lucide-react";

export function CreateInvoiceForm({ tenantId, defaultPlanId, defaultCurrency }: { tenantId: string; defaultPlanId?: string; defaultCurrency: string }) {
  const [state, formAction] = useActionState(createInvoiceAction, { ok: false });
  const { pending } = useFormStatus();

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="tenantId" value={tenantId} />
      {defaultPlanId && <input type="hidden" name="planId" value={defaultPlanId} />}
      <div>
        <Label htmlFor="subtotal">Subtotal (EGP)</Label>
        <Input id="subtotal" name="subtotal" type="number" min={0} defaultValue={2499} required />
      </div>
      <div>
        <Label htmlFor="discount">Discount</Label>
        <Input id="discount" name="discount" type="number" min={0} defaultValue={0} />
      </div>
      <div>
        <Label htmlFor="tax">Tax</Label>
        <Input id="tax" name="tax" type="number" min={0} defaultValue={0} />
      </div>
      <div>
        <Label htmlFor="total">Total (EGP)</Label>
        <Input id="total" name="total" type="number" min={0} defaultValue={2499} required />
      </div>
      <div>
        <Label htmlFor="dueDate">Due date</Label>
        <Input id="dueDate" name="dueDate" type="date" defaultValue={new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]} required />
      </div>
      <div>
        <Label htmlFor="currency">Currency</Label>
        <Input id="currency" name="currency" defaultValue={defaultCurrency} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input id="notes" name="notes" placeholder="Internal note for this invoice" />
      </div>
      <div className="sm:col-span-2">
        {state && !state.ok && state.error ? <p className="mb-2 text-xs text-destructive">{state.error}</p> : null}
        {state && state.ok ? <p className="mb-2 text-xs text-brand-success">Invoice created.</p> : null}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Creating...</> : "Create invoice"}
        </Button>
      </div>
    </form>
  );
}
