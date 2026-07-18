/**
 * B-Attend status badges — locale-aware.
 */
import { getLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getStatusLabel } from "@/lib/status-labels";

type Variant = "default" | "secondary" | "destructive" | "outline";

function variantFor(status: string): { variant: Variant; className?: string } {
  switch (status) {
    case "ACTIVE":
    case "PAID":
    case "CONFIRMED":
    case "ON_TIME":
    case "APPROVED":
      return { variant: "default", className: "bg-brand-success text-white hover:bg-brand-success/90 border-transparent" };
    case "TRIALING":
    case "TRIAL_ACTIVE":
    case "ISSUED":
      return { variant: "default", className: "bg-brand-accent text-white hover:bg-brand-accent/90 border-transparent" };
    case "PENDING_ACTIVATION":
    case "PENDING_PAYMENT":
    case "PENDING":
    case "DRAFT":
    case "NEW":
    case "OPEN":
      return { variant: "secondary", className: "bg-amber-100 text-amber-900 hover:bg-amber-200 border-transparent" };
    case "SUSPENDED":
    case "OVERDUE":
    case "PAST_DUE":
    case "REJECTED":
    case "FAILED":
    case "VOID":
    case "CANCELLED":
    case "EXPIRED":
      return { variant: "destructive" };
    case "CONTACTED":
    case "IN_PROGRESS":
    case "WAITING_CUSTOMER":
    case "GRACE_PERIOD":
    case "MANUAL_REVIEW":
      return { variant: "secondary", className: "bg-orange-100 text-orange-900 hover:bg-orange-200 border-transparent" };
    case "QUALIFIED":
      return { variant: "default", className: "bg-brand-navy text-white hover:bg-brand-navy/90 border-transparent" };
    case "WON":
      return { variant: "default", className: "bg-brand-success text-white hover:bg-brand-success/90 border-transparent" };
    case "LOST":
    case "CLOSED":
    case "RESOLVED":
      return { variant: "secondary" };
    default:
      return { variant: "outline" };
  }
}

export async function TenantStatusBadge({ status }: { status: string }) {
  const locale = await getLocale();
  const v = variantFor(status);
  return (
    <Badge variant={v.variant} className={cn(v.className)}>
      {getStatusLabel(status, locale)}
    </Badge>
  );
}

export async function SubscriptionBadge({ status }: { status: string }) {
  const locale = await getLocale();
  const v = variantFor(status);
  return (
    <Badge variant={v.variant} className={cn(v.className)}>
      {getStatusLabel(status, locale)}
    </Badge>
  );
}

export async function PlanBadge({ name, isTrial, isCustom }: { name: string; isTrial?: boolean; isCustom?: boolean }) {
  const locale = await getLocale();
  if (isTrial) {
    const label = locale === "ar" ? "تجربة" : "Trial";
    return <Badge variant="secondary" className="bg-amber-100 text-amber-900 border-transparent">{label}</Badge>;
  }
  if (isCustom) {
    const label = locale === "ar" ? "مخصص" : "Enterprise";
    return <Badge variant="default" className="bg-brand-navy text-white border-transparent">{label}</Badge>;
  }
  return <Badge variant="outline" className="border-brand-accent/30 text-brand-accent">{name}</Badge>;
}

export async function InvoiceBadge({ status }: { status: string }) {
  const locale = await getLocale();
  const v = variantFor(status);
  return (
    <Badge variant={v.variant} className={cn(v.className)}>
      {getStatusLabel(status, locale)}
    </Badge>
  );
}

export async function LeadBadge({ status }: { status: string }) {
  const locale = await getLocale();
  const v = variantFor(status);
  return (
    <Badge variant={v.variant} className={cn(v.className)}>
      {getStatusLabel(status, locale)}
    </Badge>
  );
}
