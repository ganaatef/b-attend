"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { createPolicyAction } from "../actions";
import { Loader2 } from "lucide-react";

export function PolicyForm() {
  const [state, formAction] = useActionState(createPolicyAction, { ok: false });
  const { pending } = useFormStatus();
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      <div><Label htmlFor="name">Name *</Label><Input id="name" name="name" required placeholder="Morning" /></div>
      <div><Label htmlFor="startTime">Start *</Label><Input id="startTime" name="startTime" type="time" required defaultValue="08:00" /></div>
      <div><Label htmlFor="endTime">End *</Label><Input id="endTime" name="endTime" type="time" required defaultValue="16:00" /></div>
      <div><Label htmlFor="breakMinutes">Break (min)</Label><Input id="breakMinutes" name="breakMinutes" type="number" min={0} defaultValue={60} /></div>
      <div><Label htmlFor="lateGraceMinutes">Late grace (min)</Label><Input id="lateGraceMinutes" name="lateGraceMinutes" type="number" min={0} defaultValue={10} /></div>
      <div><Label htmlFor="earlyLeaveGraceMinutes">Early leave grace (min)</Label><Input id="earlyLeaveGraceMinutes" name="earlyLeaveGraceMinutes" type="number" min={0} defaultValue={0} /></div>
      <div><Label htmlFor="overtimeStartsAfterMinutes">Overtime after (min)</Label><Input id="overtimeStartsAfterMinutes" name="overtimeStartsAfterMinutes" type="number" min={0} defaultValue={480} /></div>
      <div><Label htmlFor="weekendDays">Weekend days</Label><Input id="weekendDays" name="weekendDays" defaultValue="FRIDAY,SATURDAY" /></div>
      <div className="flex items-center gap-4 pt-5">
        <div className="flex items-center gap-2"><Checkbox id="requiresOvertimeApproval" name="requiresOvertimeApproval" value="true" defaultChecked /><Label htmlFor="requiresOvertimeApproval" className="text-xs">OT approval</Label></div>
        <div className="flex items-center gap-2"><Checkbox id="allowsMobileClockIn" name="allowsMobileClockIn" value="true" defaultChecked /><Label htmlFor="allowsMobileClockIn" className="text-xs">Mobile</Label></div>
        <div className="flex items-center gap-2"><Checkbox id="allowsKioskClockIn" name="allowsKioskClockIn" value="true" defaultChecked /><Label htmlFor="allowsKioskClockIn" className="text-xs">Kiosk</Label></div>
      </div>
      <div className="sm:col-span-3 flex items-center gap-3">
        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
        {state.ok && <p className="text-xs text-brand-success">Policy added.</p>}
        <Button type="submit" size="sm" disabled={pending} className="ml-auto">{pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...</> : "Add policy"}</Button>
      </div>
    </form>
  );
}
