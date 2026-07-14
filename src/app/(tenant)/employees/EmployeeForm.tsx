"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createEmployeeAction } from "../actions";
import type { Branch, Department, ShiftPolicy } from "@prisma/client";
import { Loader2 } from "lucide-react";

export function EmployeeForm({ branches, departments, policies }: { branches: Branch[]; departments: Department[]; policies: ShiftPolicy[] }) {
  const [state, formAction] = useActionState(createEmployeeAction, { ok: false });
  const { pending } = useFormStatus();
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      <div><Label htmlFor="employeeCode">Code *</Label><Input id="employeeCode" name="employeeCode" required placeholder="EMP001" /></div>
      <div className="sm:col-span-2"><Label htmlFor="fullName">Full name *</Label><Input id="fullName" name="fullName" required placeholder="Ahmed Mansour" /></div>
      <div><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" placeholder="+20 100 123 4567" /></div>
      <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" placeholder="ahmed@example.com" /></div>
      <div><Label htmlFor="jobTitle">Job title</Label><Input id="jobTitle" name="jobTitle" placeholder="Waiter" /></div>
      <div>
        <Label htmlFor="branchId">Branch *</Label>
        <Select name="branchId" required><SelectTrigger id="branchId"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
      </div>
      <div>
        <Label htmlFor="departmentId">Department</Label>
        <Select name="departmentId"><SelectTrigger id="departmentId"><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
      </div>
      <div>
        <Label htmlFor="employmentType">Employment type</Label>
        <Select name="employmentType" defaultValue="FULL_TIME"><SelectTrigger id="employmentType"><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="FULL_TIME">Full-time</SelectItem>
          <SelectItem value="PART_TIME">Part-time</SelectItem>
          <SelectItem value="DAILY_WORKER">Daily worker</SelectItem>
          <SelectItem value="TEMPORARY">Temporary</SelectItem>
          <SelectItem value="CONTRACTOR">Contractor</SelectItem>
        </SelectContent></Select>
      </div>
      <div>
        <Label htmlFor="defaultShiftPolicyId">Default shift policy</Label>
        <Select name="defaultShiftPolicyId"><SelectTrigger id="defaultShiftPolicyId"><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{policies.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
      </div>
      <div><Label htmlFor="pinCode">PIN</Label><Input id="pinCode" name="pinCode" placeholder="0000" /></div>
      <div className="sm:col-span-3 flex items-center gap-3">
        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
        {state.ok && <p className="text-xs text-brand-success">Employee added.</p>}
        <Button type="submit" size="sm" disabled={pending} className="ml-auto">{pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...</> : "Add employee"}</Button>
      </div>
    </form>
  );
}
