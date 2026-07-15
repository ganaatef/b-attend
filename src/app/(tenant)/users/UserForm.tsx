"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createUserAction } from "../settings/actions";
import type { Branch } from "@prisma/client";
import { Loader2, Copy } from "lucide-react";

export function UserForm({ branches }: { branches: Branch[] }) {
  const [state, formAction] = useActionState(createUserAction, { ok: false } as { ok: boolean; error?: string; tempPassword?: string });
  const { pending } = useFormStatus();

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="name">Name *</Label><Input id="name" name="name" required placeholder="Sara Adel" /></div>
        <div><Label htmlFor="email">Email *</Label><Input id="email" name="email" type="email" required placeholder="sara@company.com" /></div>
        <div>
          <Label htmlFor="role">Role *</Label>
          <Select name="role" defaultValue="EMPLOYEE">
            <SelectTrigger id="role"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="HR_ADMIN">HR Admin</SelectItem>
              <SelectItem value="BRANCH_MANAGER">Branch Manager</SelectItem>
              <SelectItem value="EMPLOYEE">Employee</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="branchId">Branch (for branch managers)</Label>
          <Select name="branchId">
            <SelectTrigger id="branchId"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.ok && state.tempPassword && (
        <div className="rounded-md border border-brand-success/30 bg-brand-success/5 p-3 text-xs">
          <p className="font-semibold text-brand-success">User invited. Temporary password:</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="rounded bg-card px-2 py-1 text-foreground">{state.tempPassword}</code>
            <button type="button" onClick={() => navigator.clipboard.writeText(state.tempPassword!)} className="text-muted-foreground hover:text-foreground"><Copy className="h-3 w-3" /></button>
          </div>
          <p className="mt-1 text-muted-foreground">Send this to the user. They will be forced to change it on first login.</p>
        </div>
      )}
      <Button type="submit" size="sm" disabled={pending}>{pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Inviting...</> : "Invite user"}</Button>
    </form>
  );
}
