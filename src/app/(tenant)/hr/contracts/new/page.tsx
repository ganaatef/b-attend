/** /hr/contracts/new — Create new employee contract */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createContractAction } from "../../actions";

export default function NewContractPage() {
  const t = useTranslations("hrContracts");
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
        <Link href="/hr/contracts" className="text-xs text-muted-foreground hover:text-foreground">{t("backToContracts")}</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">{t("newContract")}</h1>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("contractDetails")}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="employeeId">{t("employeeIdLabel")}</Label>
                <Input id="employeeId" name="employeeId" required placeholder={t("employeeIdPlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contractNumber">{t("contractNumberLabel")}</Label>
                <Input id="contractNumber" name="contractNumber" required placeholder={t("contractNumberPlaceholder")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contractType">{t("contractTypeLabel")}</Label>
              <select id="contractType" name="contractType" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" required>
                <option value="FULL_TIME">{t("fullTime")}</option>
                <option value="PART_TIME">{t("partTime")}</option>
                <option value="TEMPORARY">{t("temporary")}</option>
                <option value="DAILY_WORKER">{t("dailyWorker")}</option>
                <option value="CONTRACTOR">{t("contractor")}</option>
                <option value="INTERNSHIP">{t("internship")}</option>
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">{t("startDateLabel")}</Label>
                <Input id="startDate" name="startDate" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">{t("endDateLabel")}</Label>
                <Input id="endDate" name="endDate" type="date" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="probationEndDate">{t("probationEndLabel")}</Label>
                <Input id="probationEndDate" name="probationEndDate" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="salaryReference">{t("salaryReferenceLabel")}</Label>
                <Input id="salaryReference" name="salaryReference" type="number" placeholder={t("optionalLabel")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">{t("notesLabel")}</Label>
              <textarea id="notes" name="notes" rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder={t("notesPlaceholder")} />
            </div>

            <div className="flex justify-end gap-2">
              <Link href="/hr/contracts"><Button type="button" variant="outline" size="sm">{t("cancel")}</Button></Link>
              <Button type="submit" size="sm" disabled={pending}>{pending ? t("creating") : t("createContract")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
