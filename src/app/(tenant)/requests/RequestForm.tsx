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
import { useTranslations } from "next-intl";

export function RequestForm({ employeeId, branchId }: { employeeId: string; branchId?: string }) {
  const [state, formAction] = useActionState(submitRequestAction, { ok: false });
  const { pending } = useFormStatus();
  const [type, setType] = useState("MANUAL_CLOCK_IN");
  const t = useTranslations("requests");

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      {branchId && <input type="hidden" name="branchId" value={branchId} />}
      <div>
        <Label htmlFor="type">{t("requestType")}</Label>
        <Select name="type" value={type} onValueChange={setType}>
          <SelectTrigger id="type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MANUAL_CLOCK_IN">{t("forgotClockIn")}</SelectItem>
            <SelectItem value="MANUAL_CLOCK_OUT">{t("forgotClockOut")}</SelectItem>
            <SelectItem value="MISSING_CLOCK_OUT">{t("missingClockOut")}</SelectItem>
            <SelectItem value="OUTSIDE_GEOFENCE">{t("outsideGeofence")}</SelectItem>
            <SelectItem value="OVERTIME">{t("overtimeApproval")}</SelectItem>
            <SelectItem value="ATTENDANCE_ADJUSTMENT">{t("attendanceCorrection")}</SelectItem>
            <SelectItem value="LEAVE_REQUEST">{t("leaveRequest")}</SelectItem>
            <SelectItem value="PERMISSION_REQUEST">{t("permissionRequest")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="date">{t("dateLabel")}</Label>
          <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
        </div>
        {(type === "LEAVE_REQUEST") && (
          <div>
            <Label htmlFor="dateTo">{t("dateToLabel")}</Label>
            <Input id="dateTo" name="dateTo" type="date" />
          </div>
        )}
        {(type === "MANUAL_CLOCK_IN" || type === "ATTENDANCE_ADJUSTMENT") && (
          <div>
            <Label htmlFor="requestedClockIn">{t("requestedClockIn")}</Label>
            <Input id="requestedClockIn" name="requestedClockIn" type="time" />
          </div>
        )}
        {(type === "MANUAL_CLOCK_OUT" || type === "MISSING_CLOCK_OUT" || type === "ATTENDANCE_ADJUSTMENT") && (
          <div>
            <Label htmlFor="requestedClockOut">{t("requestedClockOut")}</Label>
            <Input id="requestedClockOut" name="requestedClockOut" type="time" />
          </div>
        )}
        {type === "PERMISSION_REQUEST" && (
          <>
            <div><Label htmlFor="fromTime">{t("fromLabel")}</Label><Input id="fromTime" name="fromTime" type="time" /></div>
            <div><Label htmlFor="toTime">{t("toLabel")}</Label><Input id="toTime" name="toTime" type="time" /></div>
          </>
        )}
      </div>
      <div>
        <Label htmlFor="reason">{t("reasonLabel")}</Label>
        <Textarea id="reason" name="reason" rows={3} required placeholder={t("reasonPlaceholder")} />
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.ok && <p className="text-xs text-brand-success">{t("submittedMessage")}</p>}
      <Button type="submit" size="sm" disabled={pending}>{pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> {t("submitting")}</> : t("submitRequest")}</Button>
    </form>
  );
}
