"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { createPayrollProfileAction } from "../../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating...</> : "Create Profile"}
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
  const [state, formAction] = useActionState<FormState, FormData>(async (prev, formData) => {
    const result = await createPayrollProfileAction(prev, formData);
    if (result?.ok) router.push("/hr/payroll-profiles");
    return result as FormState;
  }, { ok: false, error: "" });

  return (
    <Card className="border-border">
      <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Payroll Details</CardTitle></CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state && !state.ok && state.error && <p className="text-xs text-destructive">{state.error}</p>}

          <div className="space-y-1.5">
            <Label htmlFor="employeeId">Employee *</Label>
            <select id="employeeId" name="employeeId" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="">Select employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode}) — {e.branch?.name ?? "No branch"}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="baseSalary">Base Salary *</Label>
              <Input id="baseSalary" name="baseSalary" type="number" min="0" required placeholder="e.g. 10000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salaryType">Salary Type *</Label>
              <select id="salaryType" name="salaryType" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="MONTHLY">Monthly</option>
                <option value="DAILY">Daily</option>
                <option value="HOURLY">Hourly</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="EGP" placeholder="EGP" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <select id="paymentMethod" name="paymentMethod" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CASH">Cash</option>
                <option value="WALLET">Mobile Wallet</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bankName">Bank Name</Label>
              <Input id="bankName" name="bankName" placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bankAccount">Bank Account</Label>
              <Input id="bankAccount" name="bankAccount" placeholder="Optional" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="walletNumber">Wallet Number</Label>
            <Input id="walletNumber" name="walletNumber" placeholder="Optional" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dailyRate">Daily Rate</Label>
              <Input id="dailyRate" name="dailyRate" type="number" min="0" placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hourlyRate">Hourly Rate</Label>
              <Input id="hourlyRate" name="hourlyRate" type="number" min="0" placeholder="Optional" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="overtimeRateMultiplier">Overtime Rate Multiplier</Label>
            <Input id="overtimeRateMultiplier" name="overtimeRateMultiplier" type="number" min="0" step="0.1" defaultValue="1.5" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lateDeductionRule">Late Deduction Rule</Label>
            <textarea id="lateDeductionRule" name="lateDeductionRule" rows={2} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="e.g. 50 per occurrence" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="absenceDeductionRule">Absence Deduction Rule</Label>
            <textarea id="absenceDeductionRule" name="absenceDeductionRule" rows={2} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="e.g. Daily salary / 22 per day" />
          </div>

          <div className="flex justify-end gap-2">
            <a href="/hr/payroll-profiles"><Button type="button" variant="outline" size="sm">Cancel</Button></a>
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
