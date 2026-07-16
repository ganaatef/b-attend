// ===================================================================
// DemoRequestForm — client form for /request-demo.
// Uses leadAction("request-demo") server action.
// ===================================================================

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  TextField,
  TextareaField,
  NumberField,
  BusinessTypeSelect,
} from "@/components/forms/fields";
import { leadSchema, type LeadInput } from "@/lib/validations";
import { demoRequestAction, type DemoState } from "@/app/(auth)/actions";
import { CalendarCheck2 } from "lucide-react";

export function DemoRequestForm() {
  const router = useRouter();
  const t = useTranslations("demo");
  const [state, formAction, pending] = useActionState<
    DemoState,
    FormData
  >(demoRequestAction, { ok: false });

  const form = useForm<LeadInput>({
    resolver: zodResolver(leadSchema) as any,
    defaultValues: {
      name: "",
      company: "",
      phone: "",
      email: "",
      businessType: undefined,
      employeesCount: undefined,
      branchesCount: undefined,
      message: "",
      sourcePage: "request-demo",
    },
  });

  useEffect(() => {
    if (state?.ok) {
      toast.success(t("successDesc"));
      form.reset();
      router.refresh();
    } else if (state && !state.ok && state.error) {
      if (state.fieldErrors) {
        for (const [k, v] of Object.entries(state.fieldErrors)) {
          form.setError(k as keyof LeadInput, { message: v as string });
        }
      }
      if (state.error !== "Please fix the highlighted fields.") {
        toast.error(state.error);
      }
    }
  }, [state, form, router]);

  return (
    <Form {...form}>
      <form action={formAction} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="name"
            label={t("fullName")}
            placeholder="e.g. Menna Tarek"
            required
          />
          <TextField
            control={form.control}
            name="company"
            label={t("company")}
            placeholder="e.g. CloudKitchen Example"
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
            name="phone"
            label={t("phone")}
            placeholder="+20 100 123 4567"
            required
            autoComplete="tel"
          />
        </div>
        <BusinessTypeSelect
          control={form.control}
          name="businessType"
          label={t("businessType")}
          required
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField
            control={form.control}
            name="employeesCount"
            label={t("employees")}
            placeholder="e.g. 40"
            min={0}
          />
          <NumberField
            control={form.control}
            name="branchesCount"
            label={t("branches")}
            placeholder="e.g. 3"
            min={0}
          />
        </div>
        <TextareaField
          control={form.control}
          name="message"
          label={t("message")}
          placeholder={t("messagePlaceholder")}
          rows={4}
        />
        <div className="flex items-center justify-end">
          <Button type="submit" disabled={pending} className="bg-brand-navy hover:bg-brand-navy/90">
            <CalendarCheck2 className="mr-2 h-4 w-4" />
            {pending ? t("submitting") : t("submit")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
