/**
 * Subscription banner — shown at top of authenticated pages.
 * Phase 1: renders based on subscription status passed from server.
 * Phase 2+: full integration with grace period, trial days, etc.
 */
import Link from "next/link";
import { AlertTriangle, Clock, CreditCard, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubscriptionBannerProps {
  status: string;
  trialEndsAt?: Date | string | null;
  className?: string;
}

export function SubscriptionBanner({ status, trialEndsAt, className }: SubscriptionBannerProps) {
  if (!status || status === "ACTIVE") return null;

  let icon = <Clock className="h-4 w-4" />;
  let message = "";
  let tone = "info" as "info" | "warning" | "danger";

  if (status === "TRIALING" && trialEndsAt) {
    const days = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    icon = <Clock className="h-4 w-4" />;
    message = `Trial active — ${days} day${days === 1 ? "" : "s"} remaining.`;
    tone = "info";
  } else if (status === "PENDING_ACTIVATION" || status === "PENDING_PAYMENT") {
    icon = <Clock className="h-4 w-4" />;
    message = "Your account is pending activation. Our team will reach out shortly.";
    tone = "info";
  } else if (status === "PAST_DUE" || status === "GRACE_PERIOD" || status === "MANUAL_REVIEW") {
    icon = <AlertTriangle className="h-4 w-4" />;
    message = "Payment pending — please complete payment to avoid suspension.";
    tone = "warning";
  } else if (status === "SUSPENDED") {
    icon = <PauseCircle className="h-4 w-4" />;
    message = "Account suspended. Clock-in/out is disabled. Visit billing to reactivate.";
    tone = "danger";
  } else if (status === "CANCELLED") {
    icon = <PauseCircle className="h-4 w-4" />;
    message = "Account cancelled — read-only mode.";
    tone = "danger";
  }

  if (!message) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 text-sm",
        tone === "info" && "bg-brand-accent/10 text-brand-navy",
        tone === "warning" && "bg-amber-100 text-amber-900",
        tone === "danger" && "bg-brand-danger/10 text-brand-danger",
        className
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1">{message}</span>
      {(status === "PAST_DUE" || status === "GRACE_PERIOD" || status === "SUSPENDED" || status === "PENDING_PAYMENT") && (
        <Link
          href="/billing"
          className="inline-flex items-center gap-1 rounded-md bg-card/70 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-card"
        >
          <CreditCard className="h-3.5 w-3.5" />
          Billing
        </Link>
      )}
    </div>
  );
}
