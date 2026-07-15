/**
 * /legal/terms — terms of service placeholder.
 */
import { PublicLayout } from "@/components/layout/PublicLayout";

export default function TermsPage() {
  return (
    <PublicLayout>
      <section className="bg-background">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <strong>Placeholder.</strong> Production use requires legal review for your jurisdiction.
          </p>

          <div className="prose mt-8 max-w-none text-sm text-foreground/90">
            <h2 className="text-base font-semibold text-foreground">1. Acceptance of terms</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              By signing up for B-Attend, you agree to these terms on behalf of your company.
            </p>

            <h2 className="mt-8 text-base font-semibold text-foreground">2. Subscription &amp; billing</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Plans and pricing are listed on the <a href="/pricing" className="font-medium text-brand-accent hover:underline">pricing page</a>.
              Subscriptions may be monthly or annual. Manual activation may apply for B2B customers.
              Overdue invoices trigger a grace period followed by account suspension.
            </p>

            <h2 className="mt-8 text-base font-semibold text-foreground">3. Acceptable use</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>You are responsible for the accuracy of attendance data entered.</li>
              <li>You must inform employees about location capture at clock in/out.</li>
              <li>You must not use B-Attend to violate labor or data protection law.</li>
              <li>You must not attempt to access another tenant&apos;s data.</li>
            </ul>

            <h2 className="mt-8 text-base font-semibold text-foreground">4. Data &amp; privacy</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              See our <a href="/legal/privacy" className="font-medium text-brand-accent hover:underline">Privacy Policy</a> for details
              on data collection, retention, and your rights.
            </p>

            <h2 className="mt-8 text-base font-semibold text-foreground">5. Limitation of liability</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              B-Attend is provided &quot;as is&quot;. We are not liable for indirect or consequential
              damages arising from use of the platform. Our total liability is limited to the fees
              paid in the prior 12 months.
            </p>

            <h2 className="mt-8 text-base font-semibold text-foreground">6. Contact</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Questions about these terms: <a href="mailto:support@b-attend.app" className="font-medium text-brand-accent hover:underline">support@b-attend.app</a>.
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
