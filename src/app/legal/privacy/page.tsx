/**
 * /legal/privacy — Privacy Policy.
 */
import { PublicLayout } from "@/components/layout/PublicLayout";

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <section className="bg-background">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <strong>Draft — Pending Legal Review.</strong> This policy is effective as of the date
            displayed below and applies to all users of the B-Attend platform.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>

          <div className="prose mt-8 max-w-none text-sm text-foreground/90">
            {/* 1. Overview */}
            <h2 className="text-base font-semibold text-foreground">1. Overview</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              B-Attend (&quot;we&quot;, &quot;our&quot;, &quot;the Platform&quot;) is a workforce
              management SaaS solution provided by B-Attend. This Privacy Policy explains what
              personal data we collect, why we collect it, who can access it, how long we retain it,
              and the rights you have over your data. By using B-Attend you acknowledge that you have
              read and understood this policy.
            </p>

            {/* 2. Data we collect */}
            <h2 className="mt-8 text-base font-semibold text-foreground">2. Data We Collect</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We collect the following categories of information:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                <strong>Tenant (company) information:</strong> company name, business type, owner name,
                owner email, and billing details submitted during sign-up or billing.
              </li>
              <li>
                <strong>Employee information:</strong> name, phone number, email address, employee
                code, department, job title, and employment contract details — all entered by
                company administrators.
              </li>
              <li>
                <strong>Attendance data:</strong> clock-in / clock-out timestamps, latitude and
                longitude captured at the moment of clock-in or clock-out, distance from the
                assigned branch, and shift / schedule assignments.
              </li>
              <li>
                <strong>Platform usage data:</strong> audit logs of user and tenant actions, support
                ticket content, and in-app coaching interactions.
              </li>
            </ul>
            <p className="mt-2 text-sm text-muted-foreground">
              We do <strong>not</strong> collect continuous background location, biometric templates,
              or health data in the current version of the Platform.
            </p>

            {/* 3. Why we collect data */}
            <h2 className="mt-8 text-base font-semibold text-foreground">3. Why We Collect Data</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We process personal data solely for the purposes of providing and improving the
              workforce management services you subscribe to, including:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Recording and verifying employee attendance.</li>
              <li>Enforcing shift policies and geofence rules configured by the tenant.</li>
              <li>Generating payroll-ready reports and analytics.</li>
              <li>Providing HR management, leave, training, and asset tracking features.</li>
              <li>Delivering AI-powered coaching and daily briefings.</li>
              <li>Communicating with tenant administrators about account, billing, and support matters.</li>
            </ul>

            {/* 4. Who can access your data */}
            <h2 className="mt-8 text-base font-semibold text-foreground">4. Who Can Access Your Data</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Access to data within a tenant is governed by role-based permissions:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                <strong>Company Owner / HR Admin:</strong> full access to all employee records,
                attendance data, reports, and HR modules within their tenant.
              </li>
              <li>
                <strong>Branch Manager:</strong> access scoped to employees and data for their
                assigned branches.
              </li>
              <li>
                <strong>Employee:</strong> can view their own attendance, schedule, leave, training,
                assets, and profile data.
              </li>
            </ul>
            <p className="mt-2 text-sm text-muted-foreground">
              B-Attend staff may access tenant data only when strictly necessary to provide
              technical support or resolve platform issues, and only with the tenant&apos;s
              authorization or as required by law. We never sell or share tenant data with third
              parties for marketing purposes.
            </p>

            {/* 5. Data retention */}
            <h2 className="mt-8 text-base font-semibold text-foreground">5. Data Retention</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tenant data is retained for as long as the tenant&apos;s account is active. Upon
              account cancellation or expiration, data enters a soft-deleted state and is permanently
              purged after a configurable retention window. The <strong>default retention period is
              180 days</strong>; tenants may adjust this via their plan settings. Audit log retention
              follows the plan tier (30 to 730 days).
            </p>

            {/* 6. Your rights */}
            <h2 className="mt-8 text-base font-semibold text-foreground">6. Your Rights</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              If you are an employee whose data is processed through B-Attend, you have the
              following rights:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                <strong>Access:</strong> request a copy of all personal data we hold about you.
              </li>
              <li>
                <strong>Export:</strong> receive your data in a machine-readable format.
              </li>
              <li>
                <strong>Deletion:</strong> request that your personal data be deleted, subject to
                any legal retention obligations.
              </li>
              <li>
                <strong>Correction:</strong> request correction of inaccurate data.
              </li>
            </ul>
            <p className="mt-2 text-sm text-muted-foreground">
              To exercise these rights, submit a request through the{" "}
              <a href="/privacy" className="font-medium text-brand-accent hover:underline">
                Privacy Request page
              </a>{" "}
              or contact our privacy officer directly.
            </p>

            {/* 7. Security */}
            <h2 className="mt-8 text-base font-semibold text-foreground">7. Security</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We implement industry-standard technical and organisational measures to protect your
              data, including encryption in transit (TLS 1.2+), encryption at rest, role-based
              access controls, and regular security audits. Despite these measures, no method of
              transmission over the Internet is 100% secure, and we cannot guarantee absolute
              security.
            </p>

            {/* 8. International data transfers */}
            <h2 className="mt-8 text-base font-semibold text-foreground">8. International Data Transfers</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Data may be processed and stored on servers located outside your country of residence.
              By using B-Attend you consent to the transfer of your data to jurisdictions that may
              have different data protection rules than your own. We take reasonable steps to ensure
              that your data receives an adequate level of protection.
            </p>

            {/* 9. Changes to this policy */}
            <h2 className="mt-8 text-base font-semibold text-foreground">9. Changes to This Policy</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We may update this Privacy Policy from time to time. If we make material changes, we
              will notify tenant administrators by email or through the Platform. Your continued use
              of B-Attend after such changes constitutes acceptance of the updated policy.
            </p>

            {/* 10. Contact */}
            <h2 className="mt-8 text-base font-semibold text-foreground">10. Contact</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              For questions about this Privacy Policy or to exercise your data rights, contact our
              Privacy Officer:
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong>Email:</strong>{" "}
              <a href="mailto:privacy@b-attend.app" className="font-medium text-brand-accent hover:underline">
                privacy@b-attend.app
              </a>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong>Support:</strong>{" "}
              <a href="mailto:support@b-attend.app" className="font-medium text-brand-accent hover:underline">
                support@b-attend.app
              </a>
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
