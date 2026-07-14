"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createScheduleAction } from "../actions";
import type { Branch, Employee, ShiftPolicy } from "@prisma/client";
import { Loader2 } from "lucide-react";

export function ScheduleForm({ branches, employees, policies }: { branches: Branch[]; employees: Employee[]; policies: ShiftPolicy[] }) {
  const [state, formAction] = useActionState(createScheduleAction, { ok: false });
  const { pending } = useFormStatus();
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-5">
      <div className="sm:col-span-2">
        <Label htmlFor="employeeId">Employee *</Label>
        <Select name="employeeId" required><SelectTrigger id="employeeId"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</SelectItem>)}</SelectContent></Select>
      </div>
      <div>
        <Label htmlFor="branchId">Branch *</Label>
        <Select name="branchId" required><SelectTrigger id="branchId"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
      </div>
      <div>
        <Label htmlFor="date">Date *</Label>
        <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
      </div>
      <div>
        <Label htmlFor="shiftPolicyId">Policy *</Label>
        <Select name="shiftPolicyId" required><SelectTrigger id="shiftPolicyId"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{policies.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="sm:col-span-5 flex items-center gap-3">
        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
        {state.ok && <p className="text-xs text-brand-success">Schedule added.</p>}
        <Button type="submit" size="sm" disabled={pending} className="ml-auto">{pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...</> : "Add schedule"}</Button>
      </div>
    </form>
  );
}
