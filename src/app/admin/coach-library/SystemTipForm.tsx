"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSystemTipAction } from "./actions";
import { Loader2 } from "lucide-react";

const THEMES = ["PUNCTUALITY", "TEAMWORK", "CUSTOMER_SERVICE", "CLEANLINESS", "FOOD_SAFETY", "COMMUNICATION", "PRESSURE_HANDLING", "PERSONAL_DISCIPLINE", "SHIFT_READINESS", "LEARNING", "CONSISTENCY", "RESPONSIBILITY", "MOTIVATION", "GENERAL"];
const AUDIENCES = ["ALL_EMPLOYEES", "KITCHEN", "SERVICE", "CASHIER", "DELIVERY", "MANAGERS"];

export function SystemTipForm() {
  const [state, formAction] = useActionState(createSystemTipAction, { ok: false });
  const { pending } = useFormStatus();
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><Label htmlFor="title">Title *</Label><Input id="title" name="title" required placeholder="Arrive 10 minutes early" /></div>
      <div className="sm:col-span-2"><Label htmlFor="body">Body *</Label><Textarea id="body" name="body" rows={3} required /></div>
      <div>
        <Label htmlFor="theme">Theme</Label>
        <Select name="theme" defaultValue="PUNCTUALITY"><SelectTrigger id="theme"><SelectValue /></SelectTrigger><SelectContent>{THEMES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ").toLowerCase()}</SelectItem>)}</SelectContent></Select>
      </div>
      <div>
        <Label htmlFor="roleTarget">Target audience</Label>
        <Select name="roleTarget" defaultValue="ALL_EMPLOYEES"><SelectTrigger id="roleTarget"><SelectValue /></SelectTrigger><SelectContent>{AUDIENCES.map((a) => <SelectItem key={a} value={a}>{a.replace(/_/g, " ").toLowerCase()}</SelectItem>)}</SelectContent></Select>
      </div>
      <div>
        <Label htmlFor="language">Language</Label>
        <Select name="language" defaultValue="EN"><SelectTrigger id="language"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EN">English</SelectItem><SelectItem value="AR">Arabic</SelectItem></SelectContent></Select>
      </div>
      <div className="sm:col-span-2 flex items-center gap-3">
        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
        {state.ok && <p className="text-xs text-brand-success">System tip created.</p>}
        <Button type="submit" size="sm" disabled={pending} className="ml-auto">{pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...</> : "Add system tip"}</Button>
      </div>
    </form>
  );
}
