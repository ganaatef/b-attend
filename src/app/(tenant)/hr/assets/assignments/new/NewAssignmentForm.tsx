"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assignAssetAction } from "../../../actions";
import { Loader2 } from "lucide-react";

type AssetOption = { id: string; name: string; code: string | null; type: string };
type EmployeeOption = { id: string; fullName: string; employeeCode: string };

export function NewAssignmentForm({ availableAssets, employees }: { availableAssets: AssetOption[]; employees: EmployeeOption[] }) {
  const router = useRouter();
  const [state, formAction] = useActionState(assignAssetAction, { ok: false, error: "" });

  if (state.ok) {
    router.push("/hr/assets/assignments");
    return null;
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="assetId">Asset *</Label>
          <select id="assetId" name="assetId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" required>
            <option value="">Select asset</option>
            {availableAssets.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.code ?? a.type})</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="employeeId">Employee *</Label>
          <select id="employeeId" name="employeeId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" required>
            <option value="">Select employee</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="conditionOnAssign">Condition on Assign</Label>
        <Input id="conditionOnAssign" name="conditionOnAssign" placeholder="e.g. New, Good, Fair" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <textarea id="notes" name="notes" rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Optional notes" />
      </div>

      <div className="flex justify-end gap-2">
        <Link href="/hr/assets/assignments"><Button type="button" variant="outline" size="sm">Cancel</Button></Link>
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Assigning...</> : "Assign Asset"}
    </Button>
  );
}
