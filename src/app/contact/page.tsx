"use client";

/**
 * /contact form — uses the contactAction Server Action via useFormState.
 */
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { contactAction, type ContactState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2 } from "lucide-react";

const businessTypes: { value: string; label: string }[] = [
  { value: "RESTAURANT", label: "Restaurant" },
  { value: "CAFE", label: "Cafe" },
  { value: "CLOUD_KITCHEN", label: "Cloud kitchen" },
  { value: "CENTRAL_KITCHEN", label: "Central kitchen" },
  { value: "RETAIL_CHAIN", label: "Retail chain" },
  { value: "GYM", label: "Gym / Fitness" },
  { value: "CLINIC", label: "Clinic / Pharmacy" },
  { value: "WAREHOUSE", label: "Warehouse" },
  { value: "SECURITY_COMPANY", label: "Security company" },
  { value: "CLEANING_COMPANY", label: "Cleaning company" },
  { value: "MULTI_BRANCH_OPS", label: "Multi-branch operations" },
  { value: "OTHER", label: "Other" },
];

const initialState: ContactState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
        </>
      ) : (
        "Send message"
      )}
    </Button>
  );
}

export function ContactForm() {
  const [state, formAction] = useActionState<ContactState, FormData>(contactAction, initialState);

  if (state.ok) {
    return (
      <div className="rounded-lg border border-brand-success/30 bg-brand-success/5 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-brand-success" />
        <h2 className="mt-3 text-base font-semibold text-foreground">Thanks — we received your message</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Our team will get back to you within one business day.
        </p>
      </div>
    );
  }

  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Full name *</Label>
          <Input id="name" name="name" placeholder="Ahmed Mansour" required />
          {fe.name ? <p className="mt-1 text-xs text-destructive">{fe.name}</p> : null}
        </div>
        <div>
          <Label htmlFor="company">Company</Label>
          <Input id="company" name="company" placeholder="Cairo Bite Chain" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone">Phone *</Label>
          <Input id="phone" name="phone" type="tel" placeholder="+20 100 123 4567" required />
          {fe.phone ? <p className="mt-1 text-xs text-destructive">{fe.phone}</p> : null}
        </div>
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input id="email" name="email" type="email" placeholder="ahmed@example.com" required />
          {fe.email ? <p className="mt-1 text-xs text-destructive">{fe.email}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="businessType">Business type</Label>
          <Select name="businessType">
            <SelectTrigger id="businessType">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {businessTypes.map((b) => (
                <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="employeesCount">Employees</Label>
          <Input id="employeesCount" name="employeesCount" type="number" min={0} placeholder="30" />
        </div>
        <div>
          <Label htmlFor="branchesCount">Branches</Label>
          <Input id="branchesCount" name="branchesCount" type="number" min={0} placeholder="3" />
        </div>
      </div>

      <div>
        <Label htmlFor="message">Message *</Label>
        <Textarea
          id="message"
          name="message"
          rows={5}
          placeholder="Tell us what you need: number of branches, employees, scheduling complexity, etc."
          required
        />
        {fe.message ? <p className="mt-1 text-xs text-destructive">{fe.message}</p> : null}
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

export default function ContactPage() {
  return (
    <PublicLayout>
      <section className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Talk to us</h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Sales, support, partnerships — we read every message.
          </p>
        </div>
      </section>
      <section className="bg-background">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <ContactForm />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Support</p>
              <p className="mt-1 text-sm font-medium text-foreground">support@b-attend.app</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Billing</p>
              <p className="mt-1 text-sm font-medium text-foreground">billing@b-attend.app</p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
