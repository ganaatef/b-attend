// ===================================================================
// PricingCards — server component that reads plans from the DB and
// renders the pricing card grid. Used by /pricing and the landing
// page pricing preview.
// ===================================================================

import Link from "next/link";
import { db } from "@/lib/db";
import { Check, Sparkles } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export async function PricingCards({
  showAll = true,
  limit,
}: {
  showAll?: boolean;
  limit?: number;
}) {
  let plans = await db.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { features: true },
  });
  if (limit) plans = plans.slice(0, limit);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {plans.map((plan) => {
        const isCustom = plan.isCustom;
        const isTrial = plan.slug === "trial";
        const isPopular = plan.slug === "growth";
        const enabledFeatures = plan.features.filter((f) => f.enabled);

        return (
          <div
            key={plan.id}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-card p-6 text-left shadow-sm transition-all",
              isPopular
                ? "border-brand-accent/60 ring-2 ring-brand-accent/20"
                : "border-border hover:border-foreground/20",
            )}
          >
            {isPopular ? (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-brand-accent text-white">Most popular</Badge>
              </span>
            ) : null}
            <div className="mb-4">
              <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
              {plan.nameAr ? (
                <p className="text-xs text-muted-foreground" dir="rtl" lang="ar">
                  {plan.nameAr}
                </p>
              ) : null}
            </div>

            <div className="mb-5">
              {isCustom ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">Custom</span>
                </div>
              ) : isTrial ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">Free</span>
                  <span className="text-sm text-muted-foreground">14 days</span>
                </div>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">
                    {formatCurrency(plan.priceMonthly, plan.currency)}
                  </span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </div>
              )}
              {!isCustom && !isTrial && plan.priceAnnual > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  or {formatCurrency(plan.priceAnnual, plan.currency)}/yr
                </p>
              ) : null}
              {plan.description ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {plan.description}
                </p>
              ) : null}
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2 text-xs text-foreground/80">
              <div>
                <div className="font-semibold">{plan.maxBranches}</div>
                <div className="text-muted-foreground">Branches</div>
              </div>
              <div>
                <div className="font-semibold">{plan.maxEmployees}</div>
                <div className="text-muted-foreground">Employees</div>
              </div>
              <div>
                <div className="font-semibold">{plan.maxManagers}</div>
                <div className="text-muted-foreground">Managers</div>
              </div>
              <div>
                <div className="font-semibold">{plan.maxKiosks}</div>
                <div className="text-muted-foreground">Kiosks</div>
              </div>
            </div>

            <ul className="battend-scroll mb-6 max-h-44 flex-1 space-y-2 overflow-y-auto">
              {enabledFeatures.slice(0, showAll ? undefined : 6).map((f) => (
                <li key={f.id} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-success" />
                  <span className="text-foreground/80">{f.label}</span>
                </li>
              ))}
            </ul>

            <div>
              {isCustom ? (
                <Button asChild variant="outline" className="w-full">
                  <Link href="/contact?plan=enterprise">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Contact sales
                  </Link>
                </Button>
              ) : isTrial ? (
                <Button asChild className="w-full bg-brand-navy hover:bg-brand-navy/90">
                  <Link href="/signup?plan=trial">Start free trial</Link>
                </Button>
              ) : (
                <Button
                  asChild
                  className={cn(
                    "w-full",
                    isPopular
                      ? "bg-brand-accent hover:bg-brand-accent/90"
                      : "bg-brand-navy hover:bg-brand-navy/90",
                  )}
                >
                  <Link href={`/signup?plan=${plan.slug}`}>Choose {plan.name}</Link>
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
