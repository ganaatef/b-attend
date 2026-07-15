"use client";

/**
 * /signup — company owner signup request. Uses signupAction.
 * On success, shows pending activation screen.
 */
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signupAction, type SignupState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Hourglass } from "lucide-react";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import type { Plan } from "@prisma/client";

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

const initialState: SignupState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
        </>
      ) : (
        "Submit signup request"
      )}
    </Button>
  );
}

export function SignupForm({ plans }: { plans: Plan[] }) {
  const [state, formAction] = useActionState<SignupState, FormData>(signupAction, initialState);

  if (state.ok) {
    return (
      <div className="rounded-lg border border-brand-accent/30 bg-brand-accent/5 p-6 text-center">
        <Hourglass className="mx-auto h-10 w-10 text-brand-accent" />
        <h2 className="mt-3 text-base font-semibold text-foreground">Your account is being reviewed</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;ve received your signup request. Our team will review and activate your account
          shortly. You&apos;ll receive an email at <span className="font-medium text-foreground">{state.tenantId}</span> once it&apos;s ready.
        </p>
        <div className="mt-4 text-xs text-muted-foreground">
          Tenant ID: <code className="rounded bg-muted px-1.5 py-0.5">{state.tenantId}</code>
          {" · "}
          Status: <span className="font-medium text-foreground">{state.status.replace(/_/g, " ")}</span>
        </div>
        <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Link href="/login" className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto">
            Go to login
          </Link>
          <Link href="/" className="inline-flex w-full items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted sm:w-auto">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <div className="rounded-lg border border-border bg-card/50 p-4">
        <h3 className="text-sm font-semibold text-foreground">Owner details</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="fullName">Full name *</Label>
            <Input id="fullName" name="fullName" required placeholder="Ahmed Mansour" />
            {fe.fullName ? <p className="mt-1 text-xs text-destructive">{fe.fullName}</p> : null}
          </div>
          <div>
            <Label htmlFor="phone">Phone *</Label>
            <Input id="phone" name="phone" type="tel" required placeholder="+20 100 123 4567" />
            {fe.phone ? <p className="mt-1 text-xs text-destructive">{fe.phone}</p> : null}
          </div>
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input id="email" name="email" type="email" required placeholder="ahmed@example.com" />
            {fe.email ? <p className="mt-1 text-xs text-destructive">{fe.email}</p> : null}
          </div>
          <div>
            <Label htmlFor="password">Password *</Label>
            <Input id="password" name="password" type="password" required minLength={8} placeholder="Min. 8 characters" />
            {fe.password ? <p className="mt-1 text-xs text-destructive">{fe.password}</p> : null}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card/50 p-4">
        <h3 className="text-sm font-semibold text-foreground">Company details</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="companyName">Company name *</Label>
            <Input id="companyName" name="companyName" required placeholder="Cairo Bite Chain" />
            {fe.companyName ? <p className="mt-1 text-xs text-destructive">{fe.companyName}</p> : null}
          </div>
          <div>
            <Label htmlFor="businessType">Business type *</Label>
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
            {fe.businessType ? <p className="mt-1 text-xs text-destructive">{fe.businessType}</p> : null}
          </div>
          <div>
            <Label htmlFor="employeesCount">Employees count *</Label>
            <Input id="employeesCount" name="employeesCount" type="number" min={0} required placeholder="30" />
            {fe.employeesCount ? <p className="mt-1 text-xs text-destructive">{fe.employeesCount}</p> : null}
          </div>
          <div>
            <Label htmlFor="branchesCount">Branches count *</Label>
            <Input id="branchesCount" name="branchesCount" type="number" min={0} required placeholder="3" />
            {fe.branchesCount ? <p className="mt-1 text-xs text-destructive">{fe.branchesCount}</p> : null}
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" placeholder="Cairo" />
          </div>
          <div>
            <Label htmlFor="preferredPlanId">Preferred plan *</Label>
            <Select name="preferredPlanId">
              <SelectTrigger id="preferredPlanId">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.isTrial ? "Free trial" : p.isCustom ? "Custom" : `${p.priceMonthly} EGP/mo`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fe.preferredPlanId ? <p className="mt-1 text-xs text-destructive">{fe.preferredPlanId}</p> : null}
          </div>
          <div>
            <Label htmlFor="billingCycle">Billing cycle *</Label>
            <Select name="billingCycle" defaultValue="MONTHLY">
              <SelectTrigger id="billingCycle">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="ANNUAL">Annual (save 2 months)</SelectItem>
              </SelectContent>
            </Select>
            {fe.billingCycle ? <p className="mt-1 text-xs text-destructive">{fe.billingCycle}</p> : null}
          </div>
        </div>
        <div className="mt-3">
          <Label htmlFor="message">Message (optional)</Label>
          <Textarea id="message" name="message" rows={3} placeholder="Anything we should know before activation?" />
        </div>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          By submitting, you agree to our{" "}
          <Link href="/legal/terms" className="font-medium text-brand-accent hover:underline">Terms</Link> and{" "}
          <Link href="/legal/privacy" className="font-medium text-brand-accent hover:underline">Privacy Policy</Link>.
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}

export function SignupClient({ plans }: { plans: Plan[] }) {
  return (
    <PublicLayout>
      <section className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Start with B-Attend
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Submit your details. Our team will review and activate your account — usually within one business day.
          </p>
        </div>
      </section>
      <section className="bg-background">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <SignupForm plans={plans} />
        </div>
      </section>
    </PublicLayout>
  );
}

export default SignupClient;
