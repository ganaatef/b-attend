"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { updateCustomerSettingsAction } from "./actions";
import type { CompanySettings } from "@prisma/client";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function CustomerSettingsForm({ settings }: { settings: CompanySettings | null }) {
  const t = useTranslations("settings");
  const [state, formAction] = useActionState(updateCustomerSettingsAction, { ok: false });
  const { pending } = useFormStatus();
  const s = settings ?? ({} as any);
  const boolField = (key: string, fallback: boolean) => (settings as any)?.[key] ?? fallback;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div><Label htmlFor="industry">{t("industry")}</Label><Input id="industry" name="industry" defaultValue={s.industry ?? ""} placeholder="Restaurant" /></div>
        <div><Label htmlFor="timezone">{t("timezone")}</Label><Input id="timezone" name="timezone" defaultValue={s.timezone ?? "Africa/Cairo"} /></div>
        <div><Label htmlFor="currency">{t("currency")}</Label><Input id="currency" name="currency" defaultValue={s.currency ?? "EGP"} /></div>
        <div>
          <Label htmlFor="defaultLanguage">{t("defaultLanguage")}</Label>
          <Select name="defaultLanguage" defaultValue={s.defaultLanguage ?? "en"}>
            <SelectTrigger id="defaultLanguage"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">Arabic</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label htmlFor="defaultGeofenceRadius">{t("geofenceRadius")}</Label><Input id="defaultGeofenceRadius" name="defaultGeofenceRadius" type="number" min={50} max={2000} defaultValue={s.defaultGeofenceRadius ?? 150} /></div>
        <div><Label htmlFor="defaultGraceMinutes">{t("graceMinutes")}</Label><Input id="defaultGraceMinutes" name="defaultGraceMinutes" type="number" min={0} max={120} defaultValue={s.defaultGraceMinutes ?? 10} /></div>
        <div><Label htmlFor="defaultOvertimeThresholdMinutes">{t("overtimeThreshold")}</Label><Input id="defaultOvertimeThresholdMinutes" name="defaultOvertimeThresholdMinutes" type="number" min={0} max={1440} defaultValue={s.defaultOvertimeThresholdMinutes ?? 480} /></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { key: "enableMobileClock", label: t("enableMobileClock"), def: true },
          { key: "enableKioskClock", label: t("enableKioskClock"), def: true },
          { key: "requireApprovalOutsideGeofence", label: t("requireApprovalOutsideGeofence"), def: true },
          { key: "requireApprovalOvertime", label: t("requireApprovalOvertime"), def: true },
          { key: "allowNoScheduleClockIn", label: t("allowNoScheduleClockIn"), def: false },
          { key: "allowManualRequests", label: t("allowManualRequests"), def: true },
          { key: "enableEmployeeSelfService", label: t("enableEmployeeSelfService"), def: true },
          { key: "enableBranchManagerApprovals", label: t("enableBranchManagerApprovals"), def: true },
          { key: "emailNotifications", label: t("emailNotifications"), def: true },
          { key: "whatsappNotifications", label: t("whatsappNotifications"), def: false },
        ].map((f) => (
          <div key={f.key} className="flex items-center gap-2">
            <Checkbox id={f.key} name={f.key} value="true" defaultChecked={boolField(f.key, f.def)} />
            <Label htmlFor={f.key} className="text-sm">{f.label}</Label>
          </div>
        ))}
      </div>

      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.ok && <p className="text-xs text-brand-success">{t("savedMessage")}</p>}
      <Button type="submit" size="sm" disabled={pending}>{pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> {t("saveSettings")}...</> : t("saveSettings")}</Button>
    </form>
  );
}
