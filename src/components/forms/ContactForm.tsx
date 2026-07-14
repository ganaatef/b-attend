// ===================================================================
// ContactForm — client form for /contact.
// Uses leadAction("contact") server action.
// ===================================================================

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form, TextField, TextareaField } from "@/components/forms/fields";
import { leadSchema, type LeadInput } from "@/lib/validations";
import { leadAction, type LeadState } from "@/app/(public)/actions";
import { Send } from "lucide-react";

export function ContactForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    LeadState,
    FormData
  >(leadAction.bind(null, "contact"), undefined);

  const form = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
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
      toast.success("Thanks! We'll be in touch within one business day.");
      form.reset();
      router.refresh();
    } else if (state && !state.ok && state.error) {
      // Apply server-side field errors if present
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
            placeholder="e.g. Ahmed Reda"
            required
          />
          <TextField
            control={form.control}
            name="company"
            label="Company"
            placeholder="e.g. Sample Restaurant Co."
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="email"
            label="Email"
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
        <TextareaField
          control={form.control}
          name="message"
          label="How can we help?"
          placeholder="Tell us a bit about your operation, number of branches, and what you're trying to solve."
          rows={5}
        />
        <div className="flex items-center justify-end gap-3">
          <Button type="submit" disabled={pending} className="bg-brand-navy hover:bg-brand-navy/90">
            <Send className="mr-2 h-4 w-4" />
            {pending ? "Sending…" : "Send message"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
