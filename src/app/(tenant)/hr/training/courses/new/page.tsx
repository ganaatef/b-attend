"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTrainingCourseAction } from "../../../actions";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export default function NewCoursePage() {
  const t = useTranslations("hrTraining");
  const router = useRouter();
  const [state, formAction] = useActionState(createTrainingCourseAction as any, { ok: false, error: "", id: "" });
  const { pending } = useFormStatus();

  if (state.ok) {
    router.push("/hr/training/courses");
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/training/courses" className="text-xs text-muted-foreground hover:text-foreground">← {t("trainingCourses")}</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">{t("newTrainingCourse")}</h1>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">{t("courseDetails")}</CardTitle></CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            {state.error && <p className="text-xs text-destructive">{state.error}</p>}

            <div className="space-y-1.5">
              <Label htmlFor="title">{t("titleRequired")}</Label>
              <Input id="title" name="title" required placeholder="e.g. Food Safety Basics" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">{t("courseDescription")}</Label>
              <textarea id="description" name="description" rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Optional course description" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="category">{t("categoryRequired")}</Label>
                <select id="category" name="category" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" required>
                  <option value="FOOD_SAFETY">Food Safety</option>
                  <option value="CUSTOMER_SERVICE">Customer Service</option>
                  <option value="CASHIER">Cashier</option>
                  <option value="KITCHEN">Kitchen</option>
                  <option value="CLEANLINESS">Cleanliness</option>
                  <option value="SAFETY">Safety</option>
                  <option value="ONBOARDING">Onboarding</option>
                  <option value="MANAGEMENT">Management</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="validityMonths">{t("validityMonths")}</Label>
                <Input id="validityMonths" name="validityMonths" type="number" min="0" placeholder="e.g. 12" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="requiredForJobTitle">{t("requiredForJobTitle")}</Label>
              <Input id="requiredForJobTitle" name="requiredForJobTitle" placeholder="e.g. Kitchen Staff" />
            </div>

            <div className="flex justify-end gap-2">
              <Link href="/hr/training/courses"><Button type="button" variant="outline" size="sm">{t("cancel")}</Button></Link>
              <Button type="submit" size="sm" disabled={pending}>{pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> {t("creating")}</> : t("createCourse")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
