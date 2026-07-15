/**
 * /legal/privacy — privacy policy placeholder.
 */
import { PublicLayout } from "@/components/layout/PublicLayout";

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <section className="bg-background">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <strong>Placeholder.</strong> This document is a draft. Production use requires legal review
            for applicable data protection compliance.
          </p>

          <div className="prose mt-8 max-w-none text-sm text-foreground/90">
            <h2 className="text-base font-semibold text-foreground">1. Overview</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              B-Attend processes company information, employee personal data, and location data
              captured at clock in/out. We do not track employees continuously. We do not store
              biometric templates in the MVP.
            </p>

            <h2 className="mt-8 text-base font-semibold text-foreground">2. Data we collect</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Company information submitted at signup (name, business type, owner contact).</li>
              <li>Employee information added by company admins (name, phone, email, employee code).</li>
              <li>Attendance data: clock in/out timestamps, latitude, longitude, distance from branch.</li>
              <li>Audit logs of platform and tenant actions.</li>
            </ul>

            <h2 className="mt-8 text-base font-semibold text-foreground">3. Location data</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Location is captured only at the moment of clock in/out. The employer must inform
              employees and obtain any required consents under applicable labor and data protection
              law. B-Attend never collects background location.
            </p>

            <h2 className="mt-8 text-base font-semibold text-foreground">4. Data retention</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Audit log retention follows your plan (30 to 730 days). Deleted tenants&apos; data is
              soft-deleted and purged after a configurable retention window.
            </p>

            <h2 className="mt-8 text-base font-semibold text-foreground">5. Your rights</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You may request export or deletion of your data via{" "}
              <a href="mailto:support@b-attend.app" className="font-medium text-brand-accent hover:underline">
                support@b-attend.app
              </a>
              .
            </p>

            <h2 className="mt-8 text-base font-semibold text-foreground">6. Contact</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Questions about this policy: <a href="mailto:support@b-attend.app" className="font-medium text-brand-accent hover:underline">support@b-attend.app</a>.
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
