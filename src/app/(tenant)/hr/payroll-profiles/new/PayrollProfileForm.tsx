"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { createPayrollProfileAction } from "../../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("hrPayrollProfiles");
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("creating")}</> : t("createProfileBtn")}
    </Button>
  );
}

type Employee = {
  id: string;
  fullName: string;
  employeeCode: string;
  branch: { name: string } | null;
};

type FormState = { ok: boolean; error?: string; id?: string };

export function PayrollProfileForm({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const t = useTranslations("hrPayrollProfiles");
  const [state, formAction] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await createPayrollProfileAction(prev, formData);
    if (result?.ok) router.push("/hr/payroll-profiles");
    return result as FormState;
  }, { ok: false, error: "" });

  return (
    <Card className="border-border">
      <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("payrollDetails")}</CardTitle></CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state && !state.ok && state.error && <p className="text-xs text-destructive">{state.error}</p>}

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
              <Label htmlFor="baseSalary">{t("baseSalaryRequired")}</Label>
              <Input id="baseSalary" name="baseSalary" type="number" min="0" required placeholder={t("salaryPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salaryType">{t("salaryTypeRequired")}</Label>
              <select id="salaryType" name="salaryType" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="MONTHLY">{t("monthly")}</option>
                <option value="DAILY">{t("daily")}</option>
                <option value="HOURLY">{t("hourly")}</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="currency">{t("currencyLabel")}</Label>
              <Input id="currency" name="currency" defaultValue="EGP" placeholder="EGP" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paymentMethod">{t("paymentMethodLabel")}</Label>
              <select id="paymentMethod" name="paymentMethod" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="BANK_TRANSFER">{t("bankTransfer")}</option>
                <option value="CASH">{t("cash")}</option>
                <option value="WALLET">{t("mobileWallet")}</option>
                <option value="CHEQUE">{t("cheque")}</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bankName">{t("bankNameLabel")}</Label>
              <Input id="bankName" name="bankName" placeholder={t("optionalPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankAccount">{t("bankAccountLabel")}</Label>
              <Input id="bankAccount" name="bankAccount" placeholder={t("optionalPlaceholder")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="walletNumber">{t("walletNumberLabel")}</Label>
            <Input id="walletNumber" name="walletNumber" placeholder={t("optionalPlaceholder")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dailyRate">{t("dailyRateLabel")}</Label>
              <Input id="dailyRate" name="dailyRate" type="number" min="0" placeholder={t("optionalPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hourlyRate">{t("hourlyRateLabel")}</Label>
              <Input id="hourlyRate" name="hourlyRate" type="number" min="0" placeholder={t("optionalPlaceholder")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="overtimeRateMultiplier">{t("overtimeRateMultiplier")}</Label>
            <Input id="overtimeRateMultiplier" name="overtimeRateMultiplier" type="number" min="0" step="0.1" defaultValue="1.5" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lateDeductionRule">{t("lateDeductionRule")}</Label>
            <textarea id="lateDeductionRule" name="lateDeductionRule" rows={2} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder={t("lateDeductionPlaceholder")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="absenceDeductionRule">{t("absenceDeductionRule")}</Label>
            <textarea id="absenceDeductionRule" name="absenceDeductionRule" rows={2} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder={t("absenceDeductionPlaceholder")} />
          </div>

          <div className="flex justify-end gap-2">
            <a href="/hr/payroll-profiles"><Button type="button" variant="outline" size="sm">{t("cancel")}</Button></a>
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
