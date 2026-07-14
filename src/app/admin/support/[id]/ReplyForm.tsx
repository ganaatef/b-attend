"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { replyTicketAction } from "@/app/admin/actions";
import { Loader2, Send } from "lucide-react";

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const [state, formAction] = useActionState(replyTicketAction, { ok: false });
  const { pending } = useFormStatus();

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <div>
        <Label htmlFor="body">Reply</Label>
        <Textarea id="body" name="body" rows={4} placeholder="Type your reply to the customer..." required />
      </div>
      <div className="flex items-center gap-4">
        <div>
          <Label htmlFor="status">Set status</Label>
          <Select name="status" defaultValue="WAITING_CUSTOMER">
            <SelectTrigger id="status" className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="WAITING_CUSTOMER">Waiting for customer</SelectItem>
              <SelectItem value="IN_PROGRESS">In progress</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-5">
          <Checkbox id="isInternal" name="isInternal" value="true" />
          <Label htmlFor="isInternal" className="text-xs text-muted-foreground">Internal note (not visible to customer)</Label>
        </div>
      </div>
      {state && !state.ok && state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Sending...</> : <><Send className="mr-1.5 h-3.5 w-3.5" /> Send reply</>}
      </Button>
    </form>
  );
}
