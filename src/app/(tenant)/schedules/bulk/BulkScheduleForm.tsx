"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bulkScheduleAction } from "../../actions";
import type { Branch, Employee, ShiftPolicy } from "@prisma/client";
import { Loader2 } from "lucide-react";

export function BulkScheduleForm({ branches, employees, policies }: { branches: Branch[]; employees: Employee[]; policies: ShiftPolicy[] }) {
  const [state, formAction] = useActionState(bulkScheduleAction, { ok: false } as { ok: boolean; error?: string; created?: number; skipped?: number });
  const { pending } = useFormStatus();

  // Helper: collect checked employee IDs into the hidden field
  function handleSelectAll(e: React.ChangeEvent<HTMLInputElement>) {
    document.querySelectorAll<HTMLInputElement>('input[name="employeeIds"]').forEach((cb) => { if (cb.value) cb.checked = e.target.checked; });
    syncHidden();
  }
  function syncHidden() {
    const checked = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="employeeIds"]:checked')).map((cb) => cb.value);
    const hidden = document.getElementById('employeeIds-hidden') as HTMLInputElement | null;
    if (hidden) hidden.value = checked.join(",");
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="branchId">Branch *</Label>
          <Select name="branchId" required><SelectTrigger id="branchId"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
        </div>
        <div>
          <Label htmlFor="shiftPolicyId">Shift policy *</Label>
          <Select name="shiftPolicyId" required><SelectTrigger id="shiftPolicyId"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{policies.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
        </div>
        <div><Label htmlFor="dateFrom">From *</Label><Input id="dateFrom" name="dateFrom" type="date" required /></div>
        <div><Label htmlFor="dateTo">To *</Label><Input id="dateTo" name="dateTo" type="date" required /></div>
        <div className="sm:col-span-2"><Label htmlFor="weekendDays">Weekend days (comma-separated)</Label><Input id="weekendDays" name="weekendDays" defaultValue="FRIDAY,SATURDAY" /></div>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label>Employees *</Label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" onChange={handleSelectAll} /> Select all</label>
        </div>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-border bg-card p-2 space-y-1 battend-scroll">
          {employees.length === 0 ? <p className="text-xs text-muted-foreground">No employees. Add employees first.</p> : employees.map((e) => (
            <label key={e.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/40">
              <input type="checkbox" name="employeeIds" value={e.id} onChange={syncHidden} />
              <span className="text-foreground">{e.fullName}</span>
              <span className="text-xs text-muted-foreground">{e.employeeCode}</span>
            </label>
          ))}
        </div>
        <input type="hidden" id="employeeIds-hidden" name="employeeIds" value="" />
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.ok && <p className="text-xs text-brand-success">Created {state.created} schedules. Skipped {state.skipped} duplicates.</p>}
      <Button type="submit" size="sm" disabled={pending}>{pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Generating...</> : "Generate schedules"}</Button>
    </form>
  );
}
