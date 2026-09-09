"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { launchSignupAction, type LaunchSignupState } from "@/app/(auth)/launch-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Hourglass, Loader2 } from "lucide-react";
import Link from "next/link";
import type { Plan } from "@prisma/client";
import { useTranslations, useLocale } from "next-intl";
import { getStatusLabel } from "@/lib/status-labels";

const initialState: LaunchSignupState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("signup");
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

export function SignupForm({ plans }: { plans: Plan[] }) {
  const [state, formAction] = useActionState<LaunchSignupState, FormData>(launchSignupAction, initialState);
  const t = useTranslations("signup");
  const tBusiness = useTranslations("businessTypes");
  const locale = useLocale();
  const searchParams = useSearchParams();

  const selectablePlans = plans.filter((plan) => !plan.isCustom && plan.isActive);
  const requestedPlan = searchParams.get("plan");
  const defaultPlanSlug = selectablePlans.some((plan) => plan.slug === requestedPlan)
    ? requestedPlan!
    : selectablePlans.find((plan) => plan.isTrial)?.slug ?? selectablePlans[0]?.slug;
  const requestedCycle = searchParams.get("cycle");
  const defaultCycle = requestedCycle === "ANNUAL" ? "ANNUAL" : "MONTHLY";

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
    const trialCopy = locale === "ar"
      ? "تم تفعيل تجربتك المجانية. يمكنك تسجيل الدخول الآن وبدء إعداد شركتك."
      : "Your free trial is active. You can sign in now and start setting up your company.";
    const paidCopy = locale === "ar"
      ? "تم إنشاء حسابك وطلب الاشتراك. سيظل الدخول مقفولاً حتى تأكيد الدفع وتفعيل الاشتراك."
      : "Your account and subscription request were created. Access stays locked until payment is confirmed and the subscription is activated.";

    return (
      <div className="rounded-lg border border-brand-accent/30 bg-brand-accent/5 p-6 text-center">
        {state.canLogin ? (
          <CheckCircle2 className="mx-auto h-10 w-10 text-brand-success" />
        ) : (
          <Hourglass className="mx-auto h-10 w-10 text-brand-accent" />
        )}
        <h2 className="mt-3 text-base font-semibold text-foreground">
          {state.canLogin
            ? (locale === "ar" ? "التجربة جاهزة" : "Your trial is ready")
            : t("successTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{state.canLogin ? trialCopy : paidCopy}</p>
        <div className="mt-4 text-xs text-muted-foreground">
          {t("tenantId")}: <code className="rounded bg-muted px-1.5 py-0.5">{state.tenantId}</code>
          {" · "}
          {t("statusLabel")}: <span className="font-medium text-foreground">{getStatusLabel(state.status, locale)}</span>
        </div>
        <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
          {state.canLogin ? (
            <Link href="/login" className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto">
              {t("goToLogin")}
            </Link>
          ) : (
            <Link href="/contact" className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto">
              {locale === "ar" ? "التواصل لإتمام التفعيل" : "Contact us to complete activation"}
            </Link>
          )}
          <Link href="/" className="inline-flex w-full items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted sm:w-auto">
            {t("backToHome")}
          </Link>
        </div>
      </div>
    );
  }

  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <div className="rounded-lg border border-border bg-card/50 p-4">
        <h3 className="text-sm font-semibold text-foreground">{t("ownerDetails")}</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="fullName">{t("fullName")}</Label>
            <Input id="fullName" name="fullName" required placeholder="Ahmed Mansour" autoComplete="name" />
            {fe.fullName ? <p className="mt-1 text-xs text-destructive">{fe.fullName}</p> : null}
          </div>
          <div>
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input id="phone" name="phone" type="tel" required placeholder="+20 100 123 4567" autoComplete="tel" />
            {fe.phone ? <p className="mt-1 text-xs text-destructive">{fe.phone}</p> : null}
          </div>
          <div>
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" required placeholder="ahmed@example.com" autoComplete="email" />
            {fe.email ? <p className="mt-1 text-xs text-destructive">{fe.email}</p> : null}
          </div>
          <div>
            <Label htmlFor="password">{t("password")}</Label>
            <Input id="password" name="password" type="password" required minLength={8} placeholder={t("min8Chars")} autoComplete="new-password" />
            {fe.password ? <p className="mt-1 text-xs text-destructive">{fe.password}</p> : null}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card/50 p-4">
        <h3 className="text-sm font-semibold text-foreground">{t("companyDetails")}</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="companyName">{t("companyName")}</Label>
            <Input id="companyName" name="companyName" required placeholder="Cairo Bite Chain" autoComplete="organization" />
            {fe.companyName ? <p className="mt-1 text-xs text-destructive">{fe.companyName}</p> : null}
          </div>
          <div>
            <Label htmlFor="businessType">{t("businessType")}</Label>
            <Select name="businessType">
              <SelectTrigger id="businessType"><SelectValue placeholder={t("select")} /></SelectTrigger>
              <SelectContent>
                {businessTypes.map((business) => (
                  <SelectItem key={business.value} value={business.value}>{business.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fe.businessType ? <p className="mt-1 text-xs text-destructive">{fe.businessType}</p> : null}
          </div>
          <div>
            <Label htmlFor="employeesCount">{t("employeesCount")}</Label>
            <Input id="employeesCount" name="employeesCount" type="number" min={0} required placeholder="30" />
            {fe.employeesCount ? <p className="mt-1 text-xs text-destructive">{fe.employeesCount}</p> : null}
          </div>
          <div>
            <Label htmlFor="branchesCount">{t("branchesCount")}</Label>
            <Input id="branchesCount" name="branchesCount" type="number" min={0} required placeholder="3" />
            {fe.branchesCount ? <p className="mt-1 text-xs text-destructive">{fe.branchesCount}</p> : null}
          </div>
          <div>
            <Label htmlFor="city">{t("city")}</Label>
            <Input id="city" name="city" placeholder="Cairo" address="address-level2" />
          </div>
          <div>
            <Label htmlFor="preferredPlanSlug">{t("preferredPlan")}</Label>
            <Select name="preferredPlanSlug" defaultValue={defaultPlanSlug}>
              <SelectTrigger id="preferredPlanSlug"><SelectValue placeholder={t("selectPlan")} /></SelectTrigger>
              <SelectContent>
                {selectablePlans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.slug}>
                    {(locale === "ar" && plan.nameAr) ? plan.nameAr : plan.name} — {plan.isTrial ? t("freeTrial") : t("pricePerMonth", { price: plan.priceMonthly })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fe.preferredPlanSlug ? <p className="mt-1 text-xs text-destructive">{fe.preferredPlanSlug}</p> : null}
          </div>
          <div>
            <Label htmlFor="billingCycle">{t("billingCycle")}</Label>
            <Select name="billingCycle" defaultValue={defaultCycle}>
              <SelectTrigger id="billingCycle"><SelectValue placeholder={t("select")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MONTHLY">{t("monthly")}</SelectItem>
                <SelectItem value="ANNUAL">{t("annualSave")}</SelectItem>
              </SelectContent>
            </Select>
            {fe.billingCycle ? <p className="mt-1 text-xs text-destructive">{fe.billingCycle}</p> : null}
          </div>
        </div>
        <div className="mt-3">
          <Label htmlFor="message">{t("messageOptional")}</Label>
          <Textarea id="message" name="message" rows={3} placeholder={t("messagePlaceholder")} />
        </div>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {t("termsAgreement")}{" "}
          <Link href="/legal/terms" className="font-medium text-brand-accent hover:underline">{t("terms")}</Link> {" "}
          <Link href="/legal/privacy" className="font-medium text-brand-accent hover:underline">{t("privacy")}</Link>.
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}

export function SignupClient({ plans }: { plans: Plan[] }) {
  const t = useTranslations("signup");
  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("title")}</h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">{t("subtitle")}</p>
        </div>
      </section>
      <section className="bg-background">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <SignupForm plans={plans} />
        </div>
      </section>
    </>
  );
}

export default SignupClient;
