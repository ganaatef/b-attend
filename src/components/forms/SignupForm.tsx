// ===================================================================
// SignupForm — client form for /signup.
// Uses signupAction server action.
// Receives the list of plans + initial preferred plan slug from the
// server page (which reads them from DB / URL).
// ===================================================================

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  TextField,
  TextareaField,
  NumberField,
  BusinessTypeSelect,
  PlanSelect,
  BillingCycleSelect,
} from "@/components/forms/fields";
import { signupSchema, type SignupInput } from "@/lib/validations";
import { signupAction, type SignupState } from "@/app/(auth)/actions";
import { UserPlus } from "lucide-react";

export type SignupPlanOption = {
  id: string;
  name: string;
  slug: string;
  priceMonthly: number;
  isCustom: boolean;
};

export function SignupForm({
  plans,
  initialPlanId,
}: {
  plans: SignupPlanOption[];
  initialPlanId?: string;
}) {
  const t = useTranslations("signup");

  const [state, formAction, pending] = useActionState<SignupState, FormData>(
    signupAction,
    { ok: false },
  );

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema) as any,
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      companyName: "",
      businessType: undefined,
      employeesCount: undefined,
      branchesCount: undefined,
      preferredPlanId: initialPlanId ?? "",
      billingCycle: "MONTHLY",
      city: "",
      message: "",
    },
  });

  useEffect(() => {
    if (state && !state.ok) {
      if (state.fieldErrors) {
        for (const [k, v] of Object.entries(state.fieldErrors)) {
          form.setError(k as keyof SignupInput, { message: v as string });
        }
      }
      if (state.error && state.error !== "Please fix the highlighted fields.") {
        toast.error(state.error);
      }
    }
  }, [state, form]);

  return (
    <Form {...form}>
      <form action={formAction} className="space-y-6">
        {/* Owner account */}
        <fieldset className="space-y-5">
          <legend className="text-sm font-semibold text-foreground">
            {t("ownerDetails")}
          </legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="fullName"
              label={t("fullName")}
              placeholder="e.g. Ahmed Reda"
              required
              autoComplete="name"
            />
            <TextField
              control={form.control}
              name="phone"
              label={t("phone")}
              placeholder="+20 100 123 4567"
              required
              autoComplete="tel"
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="email"
              label={t("email")}
              type="email"
              placeholder="you@company.com"
              required
              autoComplete="email"
            />
            <TextField
              control={form.control}
              name="password"
              label={t("password")}
              type="password"
              placeholder={t("min8Chars")}
              required
              autoComplete="new-password"
            />
          </div>
        </fieldset>

        {/* Company */}
        <fieldset className="space-y-5 border-t border-border pt-6">
          <legend className="text-sm font-semibold text-foreground">
            {t("companyDetails")}
          </legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="companyName"
              label={t("companyName")}
              placeholder="e.g. Sample Restaurant Co."
              required
            />
            <TextField
              control={form.control}
              name="city"
              label={t("city")}
              placeholder="e.g. Cairo"
              required
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <BusinessTypeSelect
              control={form.control}
              name="businessType"
              label={t("businessType")}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                control={form.control}
                name="employeesCount"
                label={t("employeesCount")}
                placeholder="e.g. 40"
                required
                min={1}
              />
              <NumberField
                control={form.control}
                name="branchesCount"
                label={t("branchesCount")}
                placeholder="e.g. 3"
                required
                min={1}
              />
            </div>
          </div>
        </fieldset>

        {/* Plan */}
        <fieldset className="space-y-5 border-t border-border pt-6">
          <legend className="text-sm font-semibold text-foreground">
            {t("preferredPlan")} &amp; {t("billingCycle")}
          </legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <PlanSelect
              control={form.control}
              name="preferredPlanId"
              label={t("preferredPlan")}
              plans={plans}
              required
            />
            <BillingCycleSelect
              control={form.control}
              name="billingCycle"
              label={t("billingCycle")}
              required
            />
          </div>
          <TextareaField
            control={form.control}
            name="message"
            label={t("messageOptional")}
            placeholder={t("messagePlaceholder")}
            rows={3}
          />
        </fieldset>

        <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
          {t("termsAgreement")}{" "}
          <a href="/legal/terms" className="underline hover:text-foreground">
            {t("terms")}
          </a>{" "}
          {t("privacy")}
        </div>

        <div className="flex items-center justify-end">
          <Button
            type="submit"
            disabled={pending}
            className="bg-brand-navy hover:bg-brand-navy/90"
            size="lg"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {pending ? t("submitting") : t("submit")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
