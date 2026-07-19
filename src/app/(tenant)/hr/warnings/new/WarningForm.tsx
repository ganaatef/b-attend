"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { createWarningAction } from "../../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("hrWarnings");
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("creating")}</> : t("createWarning")}
    </Button>
  );
}

type Employee = { id: string; fullName: string; employeeCode: string; branch: { name: string } | null };

export function WarningForm({ employees }: { employees: Employee[] }) {
  const [state, formAction] = useActionState(createWarningAction, { ok: false, error: "" });
  const t = useTranslations("hrWarnings");

  return (
    <Card className="border-border">
      <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("warningDetails")}</CardTitle></CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state && !state.ok && state.error && <p className="text-xs text-destructive">{state.error}</p>}
          {state && state.ok && <p className="text-xs text-emerald-600">{t("createdSuccess")}</p>}

          <div className="space-y-1.5">
            <Label htmlFor="employeeId">{t("employeeRequired")}</Label>
            <select id="employeeId" name="employeeId" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="">{t("selectEmployee")}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode}) — {e.branch?.name ?? t("noBranch")}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="type">{t("typeRequired")}</Label>
              <select id="type" name="type" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">{t("selectType")}</option>
                <option value="ATTENDANCE">{t("attendance")}</option>
                <option value="BEHAVIOR">{t("behavior")}</option>
                <option value="POLICY">{t("policy")}</option>
                <option value="SAFETY">{t("safety")}</option>
                <option value="CASHIER">{t("cashier")}</option>
                <option value="CUSTOMER_COMPLAINT">{t("customerComplaint")}</option>
                <option value="OTHER">{t("other")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="severity">{t("severityRequired")}</Label>
              <select id="severity" name="severity" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">{t("selectSeverity")}</option>
                <option value="LOW">{t("low")}</option>
                <option value="MEDIUM">{t("medium")}</option>
                <option value="HIGH">{t("high")}</option>
                <option value="CRITICAL">{t("critical")}</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="date">{t("date")}</Label>
            <Input id="date" name="date" type="date" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">{t("reasonRequired")}</Label>
            <textarea id="reason" name="reason" rows={3} required className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder={t("reasonPlaceholder")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="actionTaken">{t("actionTakenLabel")}</Label>
            <textarea id="actionTaken" name="actionTaken" rows={2} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder={t("optionalPlaceholder")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">{t("notesLabel")}</Label>
            <textarea id="notes" name="notes" rows={2} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder={t("optionalPlaceholder")} />
          </div>

          <div className="flex justify-end gap-2">
            <Link href="/hr/warnings"><Button type="button" variant="outline" size="sm">{t("cancel")}</Button></Link>
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
