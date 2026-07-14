"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitRequestAction } from "../approvals/actions";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export function RequestForm({ employeeId, branchId }: { employeeId: string; branchId?: string }) {
  const [state, formAction] = useActionState(submitRequestAction, { ok: false });
  const { pending } = useFormStatus();
  const [type, setType] = useState("MANUAL_CLOCK_IN");

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      {branchId && <input type="hidden" name="branchId" value={branchId} />}
      <div>
        <Label htmlFor="type">Request type</Label>
        <Select name="type" value={type} onValueChange={setType}>
          <SelectTrigger id="type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MANUAL_CLOCK_IN">Forgot Clock In</SelectItem>
            <SelectItem value="MANUAL_CLOCK_OUT">Forgot Clock Out</SelectItem>
            <SelectItem value="MISSING_CLOCK_OUT">Missing Clock Out</SelectItem>
            <SelectItem value="OUTSIDE_GEOFENCE">Outside Geofence Approval</SelectItem>
            <SelectItem value="OVERTIME">Overtime Approval</SelectItem>
            <SelectItem value="ATTENDANCE_ADJUSTMENT">Attendance Correction</SelectItem>
            <SelectItem value="LEAVE_REQUEST">Leave Request</SelectItem>
            <SelectItem value="PERMISSION_REQUEST">Permission Request</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="date">Date *</Label>
          <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
        </div>
        {(type === "LEAVE_REQUEST") && (
          <div>
            <Label htmlFor="dateTo">Date to (for leave range)</Label>
            <Input id="dateTo" name="dateTo" type="date" />
          </div>
        )}
        {(type === "MANUAL_CLOCK_IN" || type === "ATTENDANCE_ADJUSTMENT") && (
          <div>
            <Label htmlFor="requestedClockIn">Requested clock-in time</Label>
            <Input id="requestedClockIn" name="requestedClockIn" type="time" />
          </div>
        )}
        {(type === "MANUAL_CLOCK_OUT" || type === "MISSING_CLOCK_OUT" || type === "ATTENDANCE_ADJUSTMENT") && (
          <div>
            <Label htmlFor="requestedClockOut">Requested clock-out time</Label>
            <Input id="requestedClockOut" name="requestedClockOut" type="time" />
          </div>
        )}
        {type === "PERMISSION_REQUEST" && (
          <>
            <div><Label htmlFor="fromTime">From</Label><Input id="fromTime" name="fromTime" type="time" /></div>
            <div><Label htmlFor="toTime">To</Label><Input id="toTime" name="toTime" type="time" /></div>
          </>
        )}
      </div>
      <div>
        <Label htmlFor="reason">Reason *</Label>
        <Textarea id="reason" name="reason" rows={3} required placeholder="Explain why this request is needed (min 5 chars)" />
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.ok && <p className="text-xs text-brand-success">Request submitted. Your manager will review it.</p>}
      <Button type="submit" size="sm" disabled={pending}>{pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Submitting...</> : "Submit request"}</Button>
    </form>
  );
}
