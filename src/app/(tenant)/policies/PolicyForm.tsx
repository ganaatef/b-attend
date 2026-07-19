"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { createPolicyAction } from "../actions";
import { Loader2 } from "lucide-react";

export function PolicyForm() {
  const t = useTranslations("policies");
  const [state, formAction] = useActionState(createPolicyAction, { ok: false });
  const { pending } = useFormStatus();
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-3">
      <div>
        <Label htmlFor="name" className="text-sm">{t("name")}</Label>
        <Input id="name" name="name" required placeholder={t("placeholderName")} className="mt-1" />
        {state.error === "name" && <p className="mt-1 text-xs text-destructive">{t("validation.nameRequired")}</p>}
      </div>
      <div>
        <Label htmlFor="startTime" className="text-sm">{t("startTime")}</Label>
        <Input id="startTime" name="startTime" type="time" required defaultValue="08:00" className="mt-1" />
        {state.error === "start" && <p className="mt-1 text-xs text-destructive">{t("validation.startRequired")}</p>}
      </div>
      <div>
        <Label htmlFor="endTime" className="text-sm">{t("endTime")}</Label>
        <Input id="endTime" name="endTime" type="time" required defaultValue="16:00" className="mt-1" />
        {state.error === "end" && <p className="mt-1 text-xs text-destructive">{t("validation.endRequired")}</p>}
      </div>
      <div>
        <Label htmlFor="breakMinutes" className="text-sm">{t("breakLabel")}</Label>
        <Input id="breakMinutes" name="breakMinutes" type="number" min={0} defaultValue={60} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="lateGraceMinutes" className="text-sm">{t("lateGraceLabel")}</Label>
        <Input id="lateGraceMinutes" name="lateGraceMinutes" type="number" min={0} defaultValue={10} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="earlyLeaveGraceMinutes" className="text-sm">{t("earlyLeaveGraceLabel")}</Label>
        <Input id="earlyLeaveGraceMinutes" name="earlyLeaveGraceMinutes" type="number" min={0} defaultValue={0} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="overtimeStartsAfterMinutes" className="text-sm">{t("overtimeAfterLabel")}</Label>
        <Input id="overtimeStartsAfterMinutes" name="overtimeStartsAfterMinutes" type="number" min={0} defaultValue={480} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="weekendDays" className="text-sm">{t("weekendDaysLabel")}</Label>
        <Input id="weekendDays" name="weekendDays" defaultValue="FRIDAY,SATURDAY" className="mt-1" />
      </div>
      <div className="flex items-center gap-4 pt-5">
        <div className="flex items-center gap-2">
          <Checkbox id="requiresOvertimeApproval" name="requiresOvertimeApproval" value="true" defaultChecked />
          <Label htmlFor="requiresOvertimeApproval" className="text-sm font-normal">{t("otApproval")}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="allowsMobileClockIn" name="allowsMobileClockIn" value="true" defaultChecked />
          <Label htmlFor="allowsMobileClockIn" className="text-sm font-normal">{t("mobileLabel")}</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="allowsKioskClockIn" name="allowsKioskClockIn" value="true" defaultChecked />
          <Label htmlFor="allowsKioskClockIn" className="text-sm font-normal">{t("kioskLabel")}</Label>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:col-span-3">
        {state.error && typeof state.error === "string" && (
          <p className="text-xs text-destructive">{state.error}</p>
        )}
        {state.ok && <p className="text-xs text-brand-success">{t("policyAdded")}</p>}
        <Button type="submit" size="default" disabled={pending} className="ms-auto">
          {pending ? (
            <><Loader2 className="ms-1.5 h-4 w-4 animate-spin" /> {t("saving")}</>
          ) : t("addPolicyBtn")}
        </Button>
      </div>
    </form>
  );
}
