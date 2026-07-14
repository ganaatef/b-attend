"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { replyToTicketAction } from "../../settings/actions";
import { Loader2, Send } from "lucide-react";

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const [state, formAction] = useActionState(replyToTicketAction, { ok: false });
  const { pending } = useFormStatus();
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <div><Label htmlFor="body">Your reply</Label><Textarea id="body" name="body" rows={4} required placeholder="Type your reply..." /></div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.ok && <p className="text-xs text-brand-success">Reply sent.</p>}
      <Button type="submit" size="sm" disabled={pending}>{pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Sending...</> : <><Send className="mr-1.5 h-3.5 w-3.5" /> Send reply</>}</Button>
    </form>
  );
}
