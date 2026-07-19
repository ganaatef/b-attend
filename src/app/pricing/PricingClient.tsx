"use client";
import { useState } from "react";
import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Check, X, ArrowRight } from "lucide-react";
import type { Plan, PlanFeature } from "@prisma/client";
import { formatNumber } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";
import { displaySupportLevel } from "@/lib/locale-display";

type PlanWithFeatures = Plan & { features: PlanFeature[] };

const featureOrder = [
  "mobile_clock",
  "kiosk",
  "csv_export",
  "approvals",
  "audit_log",
  "notifications",
  "support_tickets",
  "leave_requests",
  "permission_requests",
  "bulk_schedules",
  "multi_branch",
  "advanced_reports",
  "advanced_geofence",
  "api_access",
];

export function PricingClient({ plans }: { plans: PlanWithFeatures[] }) {
  const [annual, setAnnual] = useState(false);
  const t = useTranslations("pricing");
  const locale = useLocale();

  const featureLabels: Record<string, string> = {
    mobile_clock: t("mobileClockInOut"),
    kiosk: t("kioskMode"),
    csv_export: t("csvExportBom"),
    approvals: t("approvalWorkflows"),
    audit_log: t("auditLogFeature"),
    notifications: t("inAppNotifications"),
    support_tickets: t("supportTickets"),
    leave_requests: t("leaveManagement"),
    permission_requests: t("permissionRequests"),
    bulk_schedules: t("bulkScheduleGen"),
    multi_branch: t("multiBranchMgmt"),
    advanced_reports: t("advancedReports"),
    advanced_geofence: t("advancedGeofence"),
    api_access: t("apiAccess"),
  };

  return (
    <PublicLayout>
      <section className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("plansForTeams")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            {t("pricesInEGP")}
          </p>

          <div className="mt-6 inline-flex items-center rounded-lg border border-border bg-card p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                !annual ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("monthlyLabel")}
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                annual ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("annualLabel")} <span className="ml-1 text-xs text-brand-success">{t("save2Months")}</span>
            </button>
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-5">
            {plans.map((p) => {
              const price = annual ? p.priceAnnual : p.priceMonthly;
              const isCustom = p.isCustom;
              const isTrial = p.isTrial;
              return (
                <div
                  key={p.id}
                  className={`relative flex flex-col rounded-xl border bg-card p-5 ${
                    p.slug === "growth" ? "border-brand-accent shadow-md ring-1 ring-brand-accent/20" : "border-border"
                  }`}
                >
                  {p.slug === "growth" && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-accent px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                      {t("mostPopular")}
                    </span>
                  )}
                  <h3 className="text-sm font-semibold text-foreground">{p.name}</h3>
                  {p.nameAr ? <p className="text-xs text-muted-foreground">{p.nameAr}</p> : null}
                  <div className="mt-3 min-h-[3rem]">
                    {isCustom ? (
                      <p className="text-2xl font-bold text-foreground">{t("custom")}</p>
                    ) : isTrial ? (
                      <p className="text-2xl font-bold text-foreground">{t("free")}</p>
                    ) : (
                      <p className="text-2xl font-bold text-foreground">
                        {formatNumber(price)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          EGP/{annual ? t("perYear") : t("perMonth")}
                        </span>
                      </p>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground min-h-[2.5rem]">{p.description}</p>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>{p.maxBranches === 100 ? t("custom") : p.maxBranches} {p.maxBranches === 1 ? t("branch") : t("branches")}</p>
                    <p>{p.maxEmployees === 5000 ? t("custom") : p.maxEmployees} {t("employeesPlural")}</p>
                    <p>{p.maxManagers === 500 ? t("custom") : p.maxManagers} {t("managersPlural")}</p>
                    <p>{p.maxKiosks === 200 ? t("custom") : p.maxKiosks} {t("kiosksPlural")}</p>
                    <p>{p.reportsLevel.toLowerCase()} {t("reportsLevel")}</p>
                    <p>{p.auditRetentionDays}-{t("auditRetention")}</p>
                    <p className="capitalize">{displaySupportLevel(p.supportLevel, locale)} {t("supportLevelLabel")}</p>
                  </div>

                  <div className="mt-5">
                    {isCustom ? (
                      <Link
                        href="/contact"
                        className="block w-full rounded-md border border-border bg-background px-3 py-2 text-center text-sm font-semibold text-foreground hover:bg-muted"
                      >
                        {t("contactSales")}
                      </Link>
                    ) : (
                      <Link
                        href={`/signup?plan=${p.slug}`}
                        className="block w-full rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        {isTrial ? t("startTrial") : t("choosePlan", { plan: p.name })}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 text-left font-semibold text-foreground">{t("featureLabel")}</th>
                  {plans.map((p) => (
                    <th key={p.id} className="px-3 py-3 text-center font-semibold text-foreground">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureOrder.map((key) => {
                  const label = featureLabels[key] ?? key;
                  return (
                    <tr key={key} className="border-b border-border/60">
                      <td className="py-2.5 text-foreground/90">{label}</td>
                      {plans.map((p) => {
                        const f = p.features.find((x) => x.key === key);
                        const on = f?.enabled;
                        return (
                          <td key={p.id} className="px-3 py-2.5 text-center">
                            {on ? (
                              <Check className="mx-auto h-4 w-4 text-brand-success" />
                            ) : (
                              <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-10 rounded-lg border border-border bg-card p-5 text-center">
            <p className="text-sm text-muted-foreground">
              {t("needCustom")}{" "}
              <Link href="/contact" className="font-semibold text-brand-accent hover:underline">
                {t("talkToSales")} <ArrowRight className="inline h-3 w-3" />
              </Link>
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
