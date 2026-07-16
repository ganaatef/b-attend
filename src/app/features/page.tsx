import Link from "next/link";
import { PublicLayout } from "@/components/layout/PublicLayout";
import {
  Clock, MapPin, Building2, CalendarClock, CheckSquare,
  FileBarChart, Download, ShieldCheck, Users, Bell, Lock,
  ArrowRight, TabletSmartphone, ScrollText, Settings, CreditCard,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function FeaturesPage() {
  const t = await getTranslations("features");

  const groups = [
    {
      title: t("attendanceClock"),
      items: [
        { icon: Clock, title: t("mobileClockIn"), body: t("mobileClockInDesc") },
        { icon: MapPin, title: t("gpsGeofence"), body: t("gpsGeofenceDesc") },
        { icon: TabletSmartphone, title: t("branchKiosk"), body: t("branchKioskDesc") },
        { icon: ShieldCheck, title: t("antiFake"), body: t("antiFakeDesc") },
      ],
    },
    {
      title: t("scheduling"),
      items: [
        { icon: CalendarClock, title: t("shiftPolicies"), body: t("shiftPoliciesDesc") },
        { icon: CalendarClock, title: t("overnight"), body: t("overnightDesc") },
        { icon: Building2, title: t("bulkSchedule"), body: t("bulkScheduleDesc") },
        { icon: CheckSquare, title: t("approvalWorkflow"), body: t("approvalWorkflowDesc") },
      ],
    },
    {
      title: t("reportsExports"),
      items: [
        { icon: FileBarChart, title: t("dailyAttendance"), body: t("dailyAttendanceDesc") },
        { icon: FileBarChart, title: t("monthlySummary"), body: t("monthlySummaryDesc") },
        { icon: FileBarChart, title: t("exceptionsOvertime"), body: t("exceptionsOvertimeDesc") },
        { icon: Download, title: t("csvExport"), body: t("csvExportDesc") },
      ],
    },
    {
      title: t("multiTenant"),
      items: [
        { icon: Users, title: t("rolesPermissions"), body: t("rolesPermissionsDesc") },
        { icon: Lock, title: t("tenantIsolation"), body: t("tenantIsolationDesc") },
        { icon: ScrollText, title: t("auditLog"), body: t("auditLogDesc") },
        { icon: CreditCard, title: t("subscriptionBilling"), body: t("subscriptionBillingDesc") },
      ],
    },
    {
      title: t("adminOps"),
      items: [
        { icon: ShieldCheck, title: t("superAdmin"), body: t("superAdminDesc") },
        { icon: Bell, title: t("notifications"), body: t("notificationsDesc") },
        { icon: Settings, title: t("customerSettings"), body: t("customerSettingsDesc") },
        { icon: ScrollText, title: t("complianceReady"), body: t("complianceReadyDesc") },
      ],
    },
  ];

  return (
    <PublicLayout>
      <section className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            {t("subtitle")}
          </p>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {groups.map((g) => (
              <div key={g.title}>
                <h2 className="text-lg font-bold text-foreground sm:text-xl">{g.title}</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    return (
                      <div key={it.title} className="rounded-lg border border-border bg-card p-5">
                        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-brand-accent/10 text-brand-accent">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">{it.title}</h3>
                        <p className="mt-1.5 text-xs text-muted-foreground">{it.body}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 rounded-xl border border-border bg-card p-8 text-center">
            <h2 className="text-xl font-bold text-foreground">{t("readyToStart")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("readyToStartDesc")}
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
              >
                {t("startTrial")} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/request-demo"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted sm:w-auto"
              >
                {t("bookDemo")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
