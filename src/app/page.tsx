/**
 * B-Attend landing page — /
 */
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Logo } from "@/components/layout/Logo";
import { db } from "@/lib/db";
import {
  MapPin,
  Clock,
  ShieldCheck,
  CalendarClock,
  CheckSquare,
  FileBarChart,
  Download,
  Building2,
  Bell,
  Users,
  Lock,
  ArrowRight,
  Check,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

async function getActivePlans() {
  return db.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { features: true },
  });
}

export default async function HomePage() {
  const t = await getTranslations("landing");
  const tPub = await getTranslations("public");
  const tPricing = await getTranslations("pricing");
  const plans = await getActivePlans();
  const previewPlans = plans.filter((p) => !p.isCustom).slice(0, 4);

  return (
    <PublicLayout>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-card to-background">
        <div className="absolute inset-0 -z-10 opacity-50">
          <div className="absolute -top-32 right-0 h-72 w-72 rounded-full bg-brand-accent/20 blur-3xl" />
          <div className="absolute -bottom-32 left-0 h-72 w-72 rounded-full bg-brand-navy/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-success" />
              {t("footer")}
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              B-Attend
            </h1>
            <p className="mt-3 text-lg font-medium text-brand-accent sm:text-xl">
              {t("heroSubtitle")}
            </p>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              {t("heroSubtitle")}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
              >
                {t("startTrial")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/request-demo"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted sm:w-auto"
              >
                {t("bookDemo")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t("costTitle")}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              {t("costDesc1")}
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {[
              { title: t("feature1Title"), body: t("feature1Desc") },
              { title: t("feature2Title"), body: t("feature2Desc") },
              { title: t("feature6Title"), body: t("feature6Desc") },
            ].map((p) => (
              <div key={p.title} className="rounded-lg border border-border bg-card p-5">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-brand-danger/10 text-brand-danger">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{p.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {t("oneDashboard")}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                {t("costDesc2")}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Logo className="h-6 w-6" />
                <span className="text-sm font-semibold text-foreground">{t("liveAttendance")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t("featuresTitle")}
            </h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Clock, title: t("feature1Title"), body: t("feature1Desc") },
              { icon: MapPin, title: t("feature2Title"), body: t("feature2Desc") },
              { icon: Building2, title: t("feature6Title"), body: t("feature6Desc") },
              { icon: CalendarClock, title: t("feature3Title"), body: t("feature3Desc") },
              { icon: CheckSquare, title: t("feature4Title"), body: t("feature4Desc") },
              { icon: FileBarChart, title: t("feature5Title"), body: t("feature5Desc") },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-lg border border-border bg-card p-5">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-brand-accent/10 text-brand-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* PRICING PREVIEW */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t("pricingTitle")}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              {t("pricingDesc")}
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {previewPlans.map((p) => (
              <div key={p.id} className="flex flex-col rounded-lg border border-border bg-background p-5">
                <h3 className="text-sm font-semibold text-foreground">{p.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{p.description}</p>
                <div className="mt-3">
                  {p.isTrial ? (
                    <p className="text-2xl font-bold text-foreground">{tPricing("free")}</p>
                  ) : (
                    <p className="text-2xl font-bold text-foreground">
                      {formatNumber(p.priceMonthly)}{" "}
                      <span className="text-sm font-normal text-muted-foreground">EGP{tPricing("perMonth")}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("faqTitle")}
          </h2>
          <div className="mt-8 space-y-4">
            {[
              { q: t("faq1Q"), a: t("faq1A") },
              { q: t("faq2Q"), a: t("faq2A") },
              { q: t("faq3Q"), a: t("faq3A") },
              { q: t("faq4Q"), a: t("faq4A") },
            ].map((f) => (
              <div key={f.q} className="rounded-lg border border-border bg-background p-5">
                <h3 className="text-sm font-semibold text-foreground">{f.q}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-primary-foreground sm:text-3xl">
            {t("ctaTitle")}
          </h2>
          <p className="mt-3 text-sm text-primary-foreground/80 sm:text-base">
            {t("ctaSubtitle")}
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary-foreground px-5 py-3 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary-foreground/90 sm:w-auto"
            >
              {t("ctaButton")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
