"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { demoRequestAction, type DemoState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

const initialState: DemoState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("demo");
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("submitting")}
        </>
      ) : (
        t("submit")
      )}
    </Button>
  );
}

export function DemoForm() {
  const [state, formAction] = useActionState<DemoState, FormData>(demoRequestAction, initialState);
  const t = useTranslations("demo");
  const tBusiness = useTranslations("businessTypes");

  const businessTypes: { value: string; label: string }[] = [
    { value: "RESTAURANT", label: tBusiness("RESTAURANT") },
    { value: "CAFE", label: tBusiness("CAFE") },
    { value: "CLOUD_KITCHEN", label: tBusiness("CLOUD_KITCHEN") },
    { value: "CENTRAL_KITCHEN", label: tBusiness("CENTRAL_KITCHEN") },
    { value: "RETAIL_CHAIN", label: tBusiness("RETAIL_CHAIN") },
    { value: "GYM", label: tBusiness("GYM") },
    { value: "CLINIC", label: tBusiness("CLINIC") },
    { value: "WAREHOUSE", label: tBusiness("WAREHOUSE") },
    { value: "SECURITY_COMPANY", label: tBusiness("SECURITY_COMPANY") },
    { value: "CLEANING_COMPANY", label: tBusiness("CLEANING_COMPANY") },
    { value: "MULTI_BRANCH_OPS", label: tBusiness("MULTI_BRANCH_OPS") },
    { value: "OTHER", label: tBusiness("OTHER") },
  ];

  if (state.ok) {
    return (
      <div className="rounded-lg border border-brand-success/30 bg-brand-success/5 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-brand-success" />
        <h2 className="mt-3 text-base font-semibold text-foreground">{t("successTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("successDesc")}
        </p>
      </div>
    );
  }

  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">{t("fullName")}</Label>
          <Input id="name" name="name" placeholder="Ahmed Mansour" required />
          {fe.name ? <p className="mt-1 text-xs text-destructive">{fe.name}</p> : null}
        </div>
        <div>
          <Label htmlFor="company">{t("company")}</Label>
          <Input id="company" name="company" placeholder="Cairo Bite Chain" required />
          {fe.company ? <p className="mt-1 text-xs text-destructive">{fe.company}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone">{t("phone")}</Label>
          <Input id="phone" name="phone" type="tel" placeholder="+20 100 123 4567" required />
          {fe.phone ? <p className="mt-1 text-xs text-destructive">{fe.phone}</p> : null}
        </div>
        <div>
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" name="email" type="email" placeholder="ahmed@example.com" required />
          {fe.email ? <p className="mt-1 text-xs text-destructive">{fe.email}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="businessType">{t("businessType")}</Label>
          <Select name="businessType">
            <SelectTrigger id="businessType">
              <SelectValue placeholder={t("select")} />
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
          <Label htmlFor="employeesCount">{t("employees")}</Label>
          <Input id="employeesCount" name="employeesCount" type="number" min={1} placeholder="30" required />
          {fe.employeesCount ? <p className="mt-1 text-xs text-destructive">{fe.employeesCount}</p> : null}
        </div>
        <div>
          <Label htmlFor="branchesCount">{t("branches")}</Label>
          <Input id="branchesCount" name="branchesCount" type="number" min={1} placeholder="3" required />
          {fe.branchesCount ? <p className="mt-1 text-xs text-destructive">{fe.branchesCount}</p> : null}
        </div>
      </div>

      <div>
        <Label htmlFor="message">{t("message")}</Label>
        <Textarea
          id="message"
          name="message"
          rows={4}
          placeholder={t("messagePlaceholder")}
        />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <SubmitButton />
    </form>
  );
}

export default function RequestDemoPage() {
  const t = useTranslations("demo");
  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            {t("subtitle")}
          </p>
        </div>
      </section>
      <section className="bg-background">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <DemoForm />
          </div>
        </div>
      </section>
    </>
  );
}
