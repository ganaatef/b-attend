"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLeaveRequestAction } from "../../actions";

export default function NewLeaveRequestClient() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = await createLeaveRequestAction({}, formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
    } else {
      router.push("/hr/leaves");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/leaves" className="text-xs text-muted-foreground hover:text-foreground">← Leave Management</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">New Leave Request</h1>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Leave Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="employeeId">Employee ID *</Label>
                <Input id="employeeId" name="employeeId" required placeholder="Employee ID" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="leaveTypeId">Leave Type *</Label>
                <Input id="leaveTypeId" name="leaveTypeId" required placeholder="Leave Type ID" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input id="startDate" name="startDate" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">End Date *</Label>
                <Input id="endDate" name="endDate" type="date" required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason</Label>
              <textarea id="reason" name="reason" rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Optional reason" />
            </div>

            <div className="flex justify-end gap-2">
              <Link href="/hr/leaves"><Button type="button" variant="outline" size="sm">Cancel</Button></Link>
              <Button type="submit" size="sm" disabled={pending}>{pending ? "Creating..." : "Submit Request"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
