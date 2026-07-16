// ===================================================================
// ContactForm — client form for /contact.
// Uses leadAction("contact") server action.
// ===================================================================

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form, TextField, TextareaField } from "@/components/forms/fields";
import { leadSchema, type LeadInput } from "@/lib/validations";
import { contactAction, type ContactState } from "@/app/(auth)/actions";
import { Send } from "lucide-react";

export function ContactForm() {
  const router = useRouter();
  const t = useTranslations("contact");
  const [state, formAction, pending] = useActionState<
    ContactState,
    FormData
  >(contactAction, { ok: false });

  const form = useForm<LeadInput>({
    resolver: zodResolver(leadSchema) as any,
    defaultValues: {
      name: "",
      company: "",
      phone: "",
      email: "",
      message: "",
      sourcePage: "contact",
    },
  });

  useEffect(() => {
    if (state?.ok) {
      toast.success(t("successDesc"));
      form.reset();
      router.refresh();
    } else if (state && !state.ok && state.error) {
      // Apply server-side field errors if present
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
            placeholder="e.g. Ahmed Reda"
            required
          />
          <TextField
            control={form.control}
            name="company"
            label={t("company")}
            placeholder="e.g. Sample Restaurant Co."
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
        <TextareaField
          control={form.control}
          name="message"
          label={t("message")}
          placeholder={t("messagePlaceholder")}
          rows={5}
        />
        <div className="flex items-center justify-end gap-3">
          <Button type="submit" disabled={pending} className="bg-brand-navy hover:bg-brand-navy/90">
            <Send className="mr-2 h-4 w-4" />
            {pending ? t("submitting") : t("submit")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
