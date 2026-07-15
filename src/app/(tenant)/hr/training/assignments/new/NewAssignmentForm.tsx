"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assignTrainingAction } from "../../../actions";
import { Loader2 } from "lucide-react";

export function NewAssignmentForm({ employees, courses }: { employees: { id: string; fullName: string; employeeCode: string }[]; courses: { id: string; title: string }[] }) {
  const router = useRouter();
  const [state, formAction] = useActionState(assignTrainingAction as any, { ok: false, error: "", id: "" });
  const { pending } = useFormStatus();

  if (state.ok) {
    router.push("/hr/training/assignments");
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/training/assignments" className="text-xs text-muted-foreground hover:text-foreground">← Training Assignments</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">New Training Assignment</h1>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Assignment Details</CardTitle></CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            {state.error && <p className="text-xs text-destructive">{state.error}</p>}

            <div className="space-y-1.5">
              <Label htmlFor="employeeId">Employee *</Label>
              <select id="employeeId" name="employeeId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" required>
                <option value="">Select employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="courseId">Course *</Label>
              <select id="courseId" name="courseId" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" required>
                <option value="">Select course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <textarea id="notes" name="notes" rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Optional notes" />
            </div>

            <div className="flex justify-end gap-2">
              <Link href="/hr/training/assignments"><Button type="button" variant="outline" size="sm">Cancel</Button></Link>
              <Button type="submit" size="sm" disabled={pending}>{pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Assigning...</> : "Assign Training"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
