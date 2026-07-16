/**
 * (tenant)/layout — wraps all customer pages with AppShell.
 * Enforces tenant session and shows subscription banner.
 */
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { AppShell, type AppShellSession } from "@/components/layout/AppShell";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) {
    redirect("/login?next=/dashboard");
  }

  const t = await getTranslations("tenant");

  const tenant = await db.tenant.findUnique({
    where: { id: session.tenantId },
    include: { subscription: true },
  });
  if (!tenant) redirect("/login?next=/dashboard");

  if (tenant.status === "PENDING_ACTIVATION" || tenant.status === "REJECTED") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-foreground">{t("accountReview")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("accountReviewDesc", { email: tenant.ownerEmail })}
          </p>
          <p className="mt-4 text-xs text-muted-foreground">{t("status")}: {tenant.status.replace(/_/g, " ")}</p>
          <form action="/api/auth/logout" method="post" className="mt-4">
            <button type="submit" className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">{t("signOut")}</button>
          </form>
        </div>
      </div>
    );
  }

  const appShellSession: AppShellSession = {
    name: session.name,
    email: session.email,
    role: session.role,
    kind: "tenant",
    subscriptionStatus: tenant.subscription?.status,
    trialEndsAt: tenant.subscription?.trialEndsAt?.toISOString() ?? null,
  };

  return (
    <AppShell session={appShellSession}>
      <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">{t("loading")}</div>}>{children}</Suspense>
    </AppShell>
  );
}
