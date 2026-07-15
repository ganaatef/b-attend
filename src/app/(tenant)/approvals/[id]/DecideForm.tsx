"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { decideRequestAction } from "../actions";
import { Check, X, Loader2 } from "lucide-react";

export function DecideForm({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState(decideRequestAction, { ok: false });
  const { pending } = useFormStatus();

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <div>
        <Label htmlFor="managerNotes">Notes (optional)</Label>
        <Textarea id="managerNotes" name="managerNotes" rows={3} placeholder="Notes visible to the employee..." />
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.ok && <p className="text-xs text-brand-success">Decision recorded.</p>}
      <div className="flex gap-2">
        <Button type="submit" name="decision" value="APPROVED" disabled={pending} className="bg-brand-success hover:bg-brand-success/90">
          {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />} Approve
        </Button>
        <Button type="submit" name="decision" value="REJECTED" variant="destructive" disabled={pending}>
          {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1.5 h-3.5 w-3.5" />} Reject
        </Button>
      </div>
    </form>
  );
}
