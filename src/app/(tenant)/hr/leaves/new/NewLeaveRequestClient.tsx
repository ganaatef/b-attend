"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLeaveRequestAction } from "../../actions";
import { useTranslations } from "next-intl";

export default function NewLeaveRequestClient() {
  const t = useTranslations("hrLeaves");
  const tCommon = useTranslations("common");
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
        <Link href="/hr/leaves" className="text-xs text-muted-foreground hover:text-foreground">{t("backToLeave")}</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">{t("newLeaveRequest")}</h1>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("leaveDetails")}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="employeeId">{t("employeeId")}</Label>
                <Input id="employeeId" name="employeeId" required placeholder={t("employeeIdPlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="leaveTypeId">{t("leaveTypeId")}</Label>
                <Input id="leaveTypeId" name="leaveTypeId" required placeholder={t("leaveTypePlaceholder")} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">{t("startDateLabel")}</Label>
                <Input id="startDate" name="startDate" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">{t("endDateLabel")}</Label>
                <Input id="endDate" name="endDate" type="date" required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reason">{t("reasonLabel")}</Label>
              <textarea id="reason" name="reason" rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder={t("reasonPlaceholder")} />
            </div>

            <div className="flex justify-end gap-2">
              <Link href="/hr/leaves"><Button type="button" variant="outline" size="sm">{tCommon("cancel")}</Button></Link>
              <Button type="submit" size="sm" disabled={pending}>{pending ? t("creating") : t("submitRequest")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
