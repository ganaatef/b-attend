"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { replyToTicketAction } from "../../settings/actions";
import { Loader2, Send } from "lucide-react";
import { useTranslations } from "next-intl";

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations("support");
  const [state, formAction] = useActionState(replyToTicketAction, { ok: false });
  const { pending } = useFormStatus();
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <div><Label htmlFor="body">{t("yourReply")}</Label><Textarea id="body" name="body" rows={4} required placeholder={t("replyPlaceholder")} /></div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.ok && <p className="text-xs text-brand-success">{t("replySent")}</p>}
      <Button type="submit" size="sm" disabled={pending}>{pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> {t("sending")}</> : <><Send className="mr-1.5 h-3.5 w-3.5" /> {t("sendReplyBtn")}</>}</Button>
    </form>
  );
}
