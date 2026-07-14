// ===================================================================
// DemoRequestForm — client form for /request-demo.
// Uses leadAction("request-demo") server action.
// ===================================================================

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { leadAction, type LeadState } from "@/app/(public)/actions";
import { CalendarCheck2 } from "lucide-react";

export function DemoRequestForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    LeadState,
    FormData
  >(leadAction.bind(null, "request-demo"), undefined);

  const form = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
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
      toast.success("Demo request received. We'll reach out within one business day.");
      form.reset();
      router.refresh();
    } else if (state && !state.ok && state.error) {
      if (state.fieldErrors) {
        for (const [k, v] of Object.entries(state.fieldErrors)) {
          form.setError(k as keyof LeadInput, { message: v });
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
            label="Full name"
            placeholder="e.g. Menna Tarek"
            required
          />
          <TextField
            control={form.control}
            name="company"
            label="Company"
            placeholder="e.g. CloudKitchen Example"
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="email"
            label="Work email"
            type="email"
            placeholder="you@company.com"
            required
            autoComplete="email"
          />
          <TextField
            control={form.control}
            name="phone"
            label="Phone"
            placeholder="+20 100 123 4567"
            required
            autoComplete="tel"
          />
        </div>
        <BusinessTypeSelect
          control={form.control}
          name="businessType"
          label="Business type"
          required
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField
            control={form.control}
            name="employeesCount"
            label="Approx. employees"
            placeholder="e.g. 40"
            min={0}
          />
          <NumberField
            control={form.control}
            name="branchesCount"
            label="Number of branches"
            placeholder="e.g. 3"
            min={0}
          />
        </div>
        <TextareaField
          control={form.control}
          name="message"
          label="What are you trying to solve?"
          placeholder="Tell us about your current attendance process and what you'd like to improve."
          rows={4}
        />
        <div className="flex items-center justify-end">
          <Button type="submit" disabled={pending} className="bg-brand-navy hover:bg-brand-navy/90">
            <CalendarCheck2 className="mr-2 h-4 w-4" />
            {pending ? "Submitting…" : "Request demo"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
