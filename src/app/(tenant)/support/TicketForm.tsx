"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTicketAction } from "../settings/actions";
import { Loader2, Send } from "lucide-react";
import { useTranslations } from "next-intl";

export function TicketForm() {
  const t = useTranslations("support");
  const [state, formAction] = useActionState(createTicketAction, { ok: false });
  const { pending } = useFormStatus();
  return (
    <form action={formAction} className="space-y-3">
      <div><Label htmlFor="subject">{t("subject")} *</Label><Input id="subject" name="subject" required placeholder={t("placeholderSubject")} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="category">{t("category")}</Label>
          <Select name="category">
            <SelectTrigger id="category"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="GENERAL">{t("categoryGeneral")}</SelectItem>
              <SelectItem value="BILLING">{t("categoryBilling")}</SelectItem>
              <SelectItem value="TECHNICAL">{t("categoryTechnical")}</SelectItem>
              <SelectItem value="REPORTS">{t("categoryReports")}</SelectItem>
              <SelectItem value="ATTENDANCE">{t("categoryAttendance")}</SelectItem>
              <SelectItem value="OTHER">{t("categoryOther")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="priority">{t("priority")}</Label>
          <Select name="priority" defaultValue="NORMAL">
            <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">{t("priorityLow")}</SelectItem>
              <SelectItem value="NORMAL">{t("priorityNormal")}</SelectItem>
              <SelectItem value="HIGH">{t("priorityHigh")}</SelectItem>
              <SelectItem value="URGENT">{t("priorityUrgent")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label htmlFor="message">{t("message")} *</Label><Textarea id="message" name="message" rows={5} required placeholder={t("placeholderMessage")} /></div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.ok && <p className="text-xs text-brand-success">{t("ticketCreated")}</p>}
      <Button type="submit" size="sm" disabled={pending}>{pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> {t("sending")}</> : <><Send className="mr-1.5 h-3.5 w-3.5" /> {t("submitTicket")}</>}</Button>
    </form>
  );
}
