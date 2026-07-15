/** /hr/contracts/new — Create new employee contract */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createContractAction } from "../../actions";

export default function NewContractPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = await createContractAction({}, formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
    } else {
      router.push("/hr/contracts");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/contracts" className="text-xs text-muted-foreground hover:text-foreground">← Contracts</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">New Contract</h1>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Contract Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="employeeId">Employee ID *</Label>
                <Input id="employeeId" name="employeeId" required placeholder="Employee ID" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contractNumber">Contract Number *</Label>
                <Input id="contractNumber" name="contractNumber" required placeholder="e.g. CT-2026-001" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contractType">Contract Type *</Label>
              <select id="contractType" name="contractType" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" required>
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="TEMPORARY">Temporary</option>
                <option value="DAILY_WORKER">Daily Worker</option>
                <option value="CONTRACTOR">Contractor</option>
                <option value="INTERNSHIP">Internship</option>
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input id="startDate" name="startDate" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" name="endDate" type="date" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="probationEndDate">Probation End Date</Label>
                <Input id="probationEndDate" name="probationEndDate" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="salaryReference">Salary Reference</Label>
                <Input id="salaryReference" name="salaryReference" type="number" placeholder="Optional" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <textarea id="notes" name="notes" rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Optional notes" />
            </div>

            <div className="flex justify-end gap-2">
              <Link href="/hr/contracts"><Button type="button" variant="outline" size="sm">Cancel</Button></Link>
              <Button type="submit" size="sm" disabled={pending}>{pending ? "Creating..." : "Create Contract"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
