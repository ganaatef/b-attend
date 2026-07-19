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
import { updatePayrollProfileAction } from "../../../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("hrPayrollProfiles");
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("saving")}</> : t("saveChanges")}
    </Button>
  );
}

type Profile = {
  id: string;
  employeeId: string;
  baseSalary: number;
  salaryType: string;
  currency: string;
  paymentMethod: string;
  bankName: string | null;
  bankAccount: string | null;
  walletNumber: string | null;
  dailyRate: number | null;
  hourlyRate: number | null;
  overtimeRateMultiplier: number;
  lateDeductionRule: string | null;
  absenceDeductionRule: string | null;
  active: boolean;
  employee: { id: string; fullName: string; employeeCode: string };
};

type FormState = { ok: boolean; error?: string; id?: string };

export function PayrollProfileEditForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const t = useTranslations("hrPayrollProfiles");
  const [state, formAction] = useActionState<FormState, FormData>(async (prev, formData) => {
    const data: Record<string, any> = {
      baseSalary: Number(formData.get("baseSalary")),
      salaryType: formData.get("salaryType"),
      currency: formData.get("currency") || "EGP",
      paymentMethod: formData.get("paymentMethod") || "BANK_TRANSFER",
      bankName: formData.get("bankName") || null,
      bankAccount: formData.get("bankAccount") || null,
      walletNumber: formData.get("walletNumber") || null,
      dailyRate: formData.get("dailyRate") ? Number(formData.get("dailyRate")) : null,
      hourlyRate: formData.get("hourlyRate") ? Number(formData.get("hourlyRate")) : null,
      overtimeRateMultiplier: Number(formData.get("overtimeRateMultiplier")) || 1.5,
      lateDeductionRule: formData.get("lateDeductionRule") || null,
      absenceDeductionRule: formData.get("absenceDeductionRule") || null,
    };
    const result = await updatePayrollProfileAction(profile.id, data);
    if (result?.ok) router.push(`/hr/payroll-profiles/${profile.employeeId}`);
    return result as FormState;
  }, { ok: false, error: "" });

  return (
    <Card className="border-border">
      <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("payrollDetails")}</CardTitle></CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state && !state.ok && state.error && <p className="text-xs text-destructive">{state.error}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="baseSalary">{t("baseSalaryRequired")}</Label>
              <Input id="baseSalary" name="baseSalary" type="number" min="0" required defaultValue={profile.baseSalary} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salaryType">{t("salaryTypeRequired")}</Label>
              <select id="salaryType" name="salaryType" required defaultValue={profile.salaryType} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="MONTHLY">{t("monthly")}</option>
                <option value="DAILY">{t("daily")}</option>
                <option value="HOURLY">{t("hourly")}</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="currency">{t("currencyLabel")}</Label>
              <Input id="currency" name="currency" defaultValue={profile.currency} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paymentMethod">{t("paymentMethodLabel")}</Label>
              <select id="paymentMethod" name="paymentMethod" defaultValue={profile.paymentMethod} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
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
              <Input id="bankName" name="bankName" defaultValue={profile.bankName ?? ""} placeholder={t("optionalPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankAccount">{t("bankAccountLabel")}</Label>
              <Input id="bankAccount" name="bankAccount" defaultValue={profile.bankAccount ?? ""} placeholder={t("optionalPlaceholder")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="walletNumber">{t("walletNumberLabel")}</Label>
            <Input id="walletNumber" name="walletNumber" defaultValue={profile.walletNumber ?? ""} placeholder={t("optionalPlaceholder")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dailyRate">{t("dailyRateLabel")}</Label>
              <Input id="dailyRate" name="dailyRate" type="number" min="0" defaultValue={profile.dailyRate ?? ""} placeholder={t("optionalPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hourlyRate">{t("hourlyRateLabel")}</Label>
              <Input id="hourlyRate" name="hourlyRate" type="number" min="0" defaultValue={profile.hourlyRate ?? ""} placeholder={t("optionalPlaceholder")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="overtimeRateMultiplier">{t("overtimeRateMultiplier")}</Label>
            <Input id="overtimeRateMultiplier" name="overtimeRateMultiplier" type="number" min="0" step="0.1" defaultValue={profile.overtimeRateMultiplier} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lateDeductionRule">{t("lateDeductionRule")}</Label>
            <textarea id="lateDeductionRule" name="lateDeductionRule" rows={2} defaultValue={profile.lateDeductionRule ?? ""} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder={t("lateDeductionPlaceholder")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="absenceDeductionRule">{t("absenceDeductionRule")}</Label>
            <textarea id="absenceDeductionRule" name="absenceDeductionRule" rows={2} defaultValue={profile.absenceDeductionRule ?? ""} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder={t("absenceDeductionPlaceholder")} />
          </div>

          <div className="flex justify-end gap-2">
            <a href={`/hr/payroll-profiles/${profile.employeeId}`}><Button type="button" variant="outline" size="sm">{t("cancel")}</Button></a>
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
