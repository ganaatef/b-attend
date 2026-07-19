/** /hr/documents/new — Add new employee document */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDocumentAction } from "../../actions";

export default function NewDocumentPage() {
  const router = useRouter();
  const t = useTranslations("hrDocuments");
  const tc = useTranslations("common");
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
        <Link href="/hr/documents" className="text-xs text-muted-foreground hover:text-foreground">{t("backToDocuments")}</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">{t("addDocument")}</h1>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("documentDetails")}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="employeeId">{t("employeeIdLabel")}</Label>
                <Input id="employeeId" name="employeeId" required placeholder="Employee ID" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="documentType">{t("documentTypeLabel")}</Label>
                <select id="documentType" name="documentType" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" required>
                  <option value="NATIONAL_ID">{t("nationalId")}</option>
                  <option value="PASSPORT">{t("passport")}</option>
                  <option value="WORK_PERMIT">{t("workPermit")}</option>
                  <option value="HEALTH_CERTIFICATE">{t("healthCertificate")}</option>
                  <option value="FOOD_SAFETY_CERTIFICATE">{t("foodSafetyCertificate")}</option>
                  <option value="CONTRACT">{t("contract")}</option>
                  <option value="INSURANCE_FORM">{t("insuranceForm")}</option>
                  <option value="MEDICAL_CERTIFICATE">{t("medicalCertificate")}</option>
                  <option value="OTHER">{t("other")}</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="documentNumber">{t("docNumberLabel")}</Label>
              <Input id="documentNumber" name="documentNumber" placeholder={t("optionalPlaceholder")} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="issueDate">{t("issueDate")}</Label>
                <Input id="issueDate" name="issueDate" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="expiryDate">{t("expiryDate")}</Label>
                <Input id="expiryDate" name="expiryDate" type="date" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">{t("notesLabel")}</Label>
              <textarea id="notes" name="notes" rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder={t("optionalNotes")} />
            </div>

            <div className="flex justify-end gap-2">
              <Link href="/hr/documents"><Button type="button" variant="outline" size="sm">{tc("cancel")}</Button></Link>
              <Button type="submit" size="sm" disabled={pending}>{pending ? t("adding") : t("addDocumentBtn")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
