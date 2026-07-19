"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPayrollRunAction } from "../../actions";
import { Info } from "lucide-react";

const monthKeys = ["", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("hrPayrollRuns");
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? t("creating") : t("createRun")}
    </Button>
  );
}

export function NewPayrollRunForm() {
  const router = useRouter();
  const t = useTranslations("hrPayrollRuns");
  const [state, formAction] = useActionState(
    async (prev: any, formData: FormData) => {
      const result = await createPayrollRunAction(prev, formData);
      if (result.ok) {
        if (result.warnings && result.warnings.length > 0) {
          alert(t("createdWarnings", { warnings: result.warnings.join("\n") }));
        }
        router.push(`/hr/payroll-runs/${result.id}`);
      }
      return result;
    },
    { ok: false, error: "" }
  );

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/payroll-runs" className="text-xs text-muted-foreground hover:text-foreground">
          ← {t("title")}
        </Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">{t("newPayrollRun")}</h1>
      </div>

      <Card className="border-border bg-blue-50/30 border-blue-200">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-blue-700">
                {t("linesInfo")}
              </p>
              <p className="text-xs text-blue-500 mt-1">
                {t("taxNoteShort")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">{t("runDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            {state.error && <p className="text-xs text-destructive">{state.error}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="month">{t("month")} *</Label>
                <select
                  id="month"
                  name="month"
                  defaultValue={currentMonth}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {monthKeys.slice(1).map((key, i) => (
                    <option key={i + 1} value={i + 1}>
                      {t(key)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="year">{t("year")} *</Label>
                <Input
                  id="year"
                  name="year"
                  type="number"
                  min={2020}
                  max={2050}
                  defaultValue={currentYear}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">{t("notes")}</Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                placeholder={t("optionalNotes")}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Link href="/hr/payroll-runs">
                <Button type="button" variant="outline" size="sm">
                  {t("cancelRun")}
                </Button>
              </Link>
              <SubmitButton />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
