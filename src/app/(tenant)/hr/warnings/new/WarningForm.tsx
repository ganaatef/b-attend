"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { createWarningAction } from "../../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating...</> : "Create Warning"}
    </Button>
  );
}

type Employee = { id: string; fullName: string; employeeCode: string; branch: { name: string } | null };

export function WarningForm({ employees }: { employees: Employee[] }) {
  const [state, formAction] = useActionState(createWarningAction, { ok: false, error: "" });

  return (
    <Card className="border-border">
      <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Warning Details</CardTitle></CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state && !state.ok && state.error && <p className="text-xs text-destructive">{state.error}</p>}
          {state && state.ok && <p className="text-xs text-emerald-600">Warning created successfully.</p>}

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
              <Label htmlFor="type">Type *</Label>
              <select id="type" name="type" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Select type</option>
                <option value="ATTENDANCE">Attendance</option>
                <option value="BEHAVIOR">Behavior</option>
                <option value="POLICY">Policy</option>
                <option value="SAFETY">Safety</option>
                <option value="CASHIER">Cashier</option>
                <option value="CUSTOMER_COMPLAINT">Customer Complaint</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="severity">Severity *</Label>
              <select id="severity" name="severity" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="">Select severity</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="date">Date *</Label>
            <Input id="date" name="date" type="date" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason *</Label>
            <textarea id="reason" name="reason" rows={3} required className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Describe the reason for this warning" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="actionTaken">Action Taken</Label>
            <textarea id="actionTaken" name="actionTaken" rows={2} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Optional" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <textarea id="notes" name="notes" rows={2} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Optional" />
          </div>

          <div className="flex justify-end gap-2">
            <Link href="/hr/warnings"><Button type="button" variant="outline" size="sm">Cancel</Button></Link>
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
