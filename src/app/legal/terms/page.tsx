/**
 * /legal/terms — Terms of Service.
 */
import { PublicLayout } from "@/components/layout/PublicLayout";

export default function TermsPage() {
  return (
    <PublicLayout>
      <section className="bg-background">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <strong>Draft — Pending Legal Review.</strong> These terms govern your use of the
            B-Attend platform. By signing up you agree to them on behalf of your organisation.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>

          <div className="prose mt-8 max-w-none text-sm text-foreground/90">
            {/* 1. Service description */}
            <h2 className="text-base font-semibold text-foreground">1. Service Description</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              B-Attend is a cloud-based workforce management SaaS platform that provides attendance
              tracking, shift scheduling, HR management, payroll-ready reporting, and AI-powered
              coaching tools for operational teams. The service is provided by B-Attend
              (&quot;we&quot;, &quot;our&quot;, &quot;the Company&quot;).
            </p>

            {/* 2. Acceptance of terms */}
            <h2 className="mt-8 text-base font-semibold text-foreground">2. Acceptance of Terms</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              By creating an account or using B-Attend, you represent that you have the authority to
              bind your organisation to these Terms. If you do not agree, do not use the service.
            </p>

            {/* 3. Account responsibility */}
            <h2 className="mt-8 text-base font-semibold text-foreground">3. Account Responsibility</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You must ensure that all users under your account comply with these Terms.</li>
              <li>You must notify us immediately of any unauthorised use of your account.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
            </ul>

            {/* 4. Data ownership */}
            <h2 className="mt-8 text-base font-semibold text-foreground">4. Data Ownership</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong>You own your data.</strong> All data submitted by your organisation — including
              employee records, attendance data, schedules, and reports — remains your property.
              B-Attend acts as a data processor on your behalf. We will not use your data for any
              purpose other than providing the contracted service, and we will delete your data upon
              request in accordance with our{" "}
              <a href="/legal/privacy" className="font-medium text-brand-accent hover:underline">
                Privacy Policy
              </a>.
            </p>

            {/* 5. Acceptable use */}
            <h2 className="mt-8 text-base font-semibold text-foreground">5. Acceptable Use</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You agree to use B-Attend only for lawful purposes and in compliance with all
              applicable laws and regulations, including but not limited to labour law and data
              protection legislation. You must:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Inform employees about attendance tracking and location capture at clock-in/out.</li>
              <li>Obtain any consents required under applicable law before collecting employee data.</li>
              <li>Ensure the accuracy of data entered into the Platform.</li>
              <li>Not attempt to access, modify, or interfere with another tenant&apos;s data.</li>
              <li>Not use the Platform to transmit malicious code, spam, or illegal content.</li>
              <li>Not reverse-engineer, decompile, or extract source code from the Platform.</li>
            </ul>

            {/* 6. Subscription and billing */}
            <h2 className="mt-8 text-base font-semibold text-foreground">6. Subscription &amp; Billing</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Plans and pricing are listed on the{" "}
              <a href="/pricing" className="font-medium text-brand-accent hover:underline">
                pricing page
              </a>. Subscriptions may be monthly or annual. Manual activation may apply for B2B
              customers. Overdue invoices trigger a grace period followed by account suspension.
              All fees are non-refundable except as required by applicable law.
            </p>

            {/* 7. Limitation of liability */}
            <h2 className="mt-8 text-base font-semibold text-foreground">7. Limitation of Liability</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              B-Attend is provided &quot;as is&quot; and &quot;as available&quot;. To the maximum
              extent permitted by law, we disclaim all warranties, express or implied. We are not
              liable for any indirect, incidental, special, consequential, or punitive damages
              arising from your use of the Platform. Our total aggregate liability to you for all
              claims arising out of or relating to these Terms or the Platform shall not exceed the
              total fees paid by you to B-Attend in the twelve (12) months immediately preceding
              the event giving rise to the claim.
            </p>

            {/* 8. Indemnification */}
            <h2 className="mt-8 text-base font-semibold text-foreground">8. Indemnification</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You agree to indemnify, defend, and hold harmless B-Attend and its officers, directors,
              employees, and agents from and against any claims, liabilities, damages, losses, and
              expenses (including reasonable legal fees) arising from your use of the Platform,
              violation of these Terms, or infringement of any applicable law or third-party right.
            </p>

            {/* 9. Termination */}
            <h2 className="mt-8 text-base font-semibold text-foreground">9. Termination</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Either party may terminate this agreement in accordance with the subscription terms.
              Upon termination, your right to use the Platform ceases. We will retain your data for
              a period of 180 days (or as otherwise specified in your plan) after termination,
              during which you may request data export.
            </p>

            {/* 10. Governing law */}
            <h2 className="mt-8 text-base font-semibold text-foreground">10. Governing Law</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              These Terms shall be governed by and construed in accordance with the laws of the
              <strong> Arab Republic of Egypt</strong>. Any disputes arising under or in connection
              with these Terms shall be subject to the exclusive jurisdiction of the competent
              courts in Cairo, Egypt.
            </p>

            {/* 11. Changes to these terms */}
            <h2 className="mt-8 text-base font-semibold text-foreground">11. Changes to These Terms</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We reserve the right to modify these Terms at any time. Material changes will be
              communicated to tenant administrators at least 30 days before they take effect.
              Continued use of the Platform after changes become effective constitutes acceptance
              of the updated Terms.
            </p>

            {/* 12. Contact */}
            <h2 className="mt-8 text-base font-semibold text-foreground">12. Contact</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Questions about these Terms:{" "}
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
