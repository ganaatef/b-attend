"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { assignAssetAction } from "../../actions";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function AssignAssetForm({ assetId }: { assetId: string }) {
  const t = useTranslations("hrAssets");
  const [state, formAction] = useActionState(assignAssetAction, { ok: false, error: "" });

  if (state.ok) {
    return <p className="text-xs text-brand-success">{t("assetAssigned")}</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="assetId" value={assetId} />
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="employeeId">{t("employeeIdLabel")}</Label>
          <Input id="employeeId" name="employeeId" required placeholder={t("employeeIdPlaceholder")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="conditionOnAssign">{t("conditionOnAssign")}</Label>
          <Input id="conditionOnAssign" name="conditionOnAssign" placeholder={t("conditionPlaceholder")} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="assign-notes">{t("notesCard")}</Label>
        <Input id="assign-notes" name="notes" placeholder={t("optionalNotes")} />
      </div>
      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const t = useTranslations("hrAssets");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> {t("assigning")}</> : t("assignAssetBtn")}
    </Button>
  );
}
