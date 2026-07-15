"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { assignAssetAction } from "../../actions";
import { Loader2 } from "lucide-react";

export function AssignAssetForm({ assetId }: { assetId: string }) {
  const [state, formAction] = useActionState(assignAssetAction, { ok: false, error: "" });

  if (state.ok) {
    return <p className="text-xs text-brand-success">Asset assigned successfully.</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="assetId" value={assetId} />
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="employeeId">Employee ID *</Label>
          <Input id="employeeId" name="employeeId" required placeholder="Employee ID" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="conditionOnAssign">Condition on Assign</Label>
          <Input id="conditionOnAssign" name="conditionOnAssign" placeholder="e.g. New, Good" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="assign-notes">Notes</Label>
        <Input id="assign-notes" name="notes" placeholder="Optional notes" />
      </div>
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Assigning...</> : "Assign Asset"}
    </Button>
  );
}
