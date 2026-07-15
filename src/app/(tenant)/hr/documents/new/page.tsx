/** /hr/documents/new — Add new employee document */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDocumentAction } from "../../actions";

export default function NewDocumentPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = await createDocumentAction({}, formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
    } else {
      router.push("/hr/documents");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/documents" className="text-xs text-muted-foreground hover:text-foreground">← Documents</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">Add Document</h1>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Document Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="employeeId">Employee ID *</Label>
                <Input id="employeeId" name="employeeId" required placeholder="Employee ID" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="documentType">Document Type *</Label>
                <select id="documentType" name="documentType" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" required>
                  <option value="NATIONAL_ID">National ID</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="WORK_PERMIT">Work Permit</option>
                  <option value="HEALTH_CERTIFICATE">Health Certificate</option>
                  <option value="FOOD_SAFETY_CERTIFICATE">Food Safety Certificate</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INSURANCE_FORM">Insurance Form</option>
                  <option value="MEDICAL_CERTIFICATE">Medical Certificate</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="documentNumber">Document Number</Label>
              <Input id="documentNumber" name="documentNumber" placeholder="Optional" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="issueDate">Issue Date</Label>
                <Input id="issueDate" name="issueDate" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input id="expiryDate" name="expiryDate" type="date" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <textarea id="notes" name="notes" rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Optional notes" />
            </div>

            <div className="flex justify-end gap-2">
              <Link href="/hr/documents"><Button type="button" variant="outline" size="sm">Cancel</Button></Link>
              <Button type="submit" size="sm" disabled={pending}>{pending ? "Adding..." : "Add Document"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
