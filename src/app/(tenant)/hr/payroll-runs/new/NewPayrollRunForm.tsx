"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPayrollRunAction } from "../../actions";
import { Info } from "lucide-react";

const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Creating..." : "Create Payroll Run"}
    </Button>
  );
}

export function NewPayrollRunForm() {
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (prev: any, formData: FormData) => {
      const result = await createPayrollRunAction(prev, formData);
      if (result.ok) {
        if (result.warnings && result.warnings.length > 0) {
          alert(`Created with warnings:\n${result.warnings.join("\n")}`);
        }
        router.push(`/hr/payroll-runs/${result.id}`);
      }
      return result;
    },
    { ok: false, error: "" }
  );

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/payroll-runs" className="text-xs text-muted-foreground hover:text-foreground">
          ← Payroll Runs
        </Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">New Payroll Run</h1>
      </div>

      <Card className="border-border bg-blue-50/30 border-blue-200">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-blue-700">
                Lines will be generated from AttendanceDay data. Employees without active payroll profiles will appear in warnings.
              </p>
              <p className="text-[10px] text-blue-500 mt-1">
                Note: Tax and social insurance are not calculated in this MVP.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Run Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            {state.error && <p className="text-xs text-destructive">{state.error}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="month">Month *</Label>
                <select
                  id="month"
                  name="month"
                  defaultValue={currentMonth}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {monthNames.slice(1).map((name, i) => (
                    <option key={i + 1} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="year">Year *</Label>
                <Input
                  id="year"
                  name="year"
                  type="number"
                  min={2020}
                  max={2050}
                  defaultValue={currentYear}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                placeholder="Optional notes about this payroll run"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Link href="/hr/payroll-runs">
                <Button type="button" variant="outline" size="sm">
                  Cancel
                </Button>
              </Link>
              <SubmitButton />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
