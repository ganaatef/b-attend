"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logPlatformEvent } from "@/lib/auth/audit";

async function requireBillingAdmin() {
  const session = await getSession();
  if (!session || session.kind !== "platform") throw new Error("FORBIDDEN");
  if (!new Set(["SUPER_ADMIN", "BILLING_ADMIN"]).has(session.role)) throw new Error("FORBIDDEN");
  return session;
}

function subscriptionPeriodEnd(start: Date, cycle: "MONTHLY" | "ANNUAL") {
  const end = new Date(start);
  if (cycle === "ANNUAL") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

const PaymentMethodSchema = z.enum(["BANK_TRANSFER", "CASH", "MANUAL"]);

export async function markInvoicePaidAndActivateAction(invoiceId: string, paymentMethod: string) {
  const session = await requireBillingAdmin();
  const parsedMethod = PaymentMethodSchema.safeParse(paymentMethod);
  if (!parsedMethod.success) return { ok: false, error: "Unsupported payment method." };

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { tenant: { include: { subscription: true } } },
  });
  if (!invoice) return { ok: false, error: "Invoice not found." };
  if (invoice.status === "VOID" || invoice.status === "REFUNDED") {
    return { ok: false, error: "This invoice cannot be paid." };
  }

  const subscription = invoice.tenant.subscription;
  if (!subscription) return { ok: false, error: "Subscription not found." };
  if (invoice.planId && invoice.planId !== subscription.planId) {
    return { ok: false, error: "Invoice plan does not match the tenant's current subscription." };
  }

  const paidAt = invoice.paidAt ?? new Date();
  const periodEnd = subscriptionPeriodEnd(paidAt, subscription.billingCycle);

  await db.$transaction(async (tx) => {
    if (invoice.status !== "PAID") {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "PAID",
          paidAt,
          paymentMethod: parsedMethod.data,
          billingPeriodStart: paidAt,
          billingPeriodEnd: periodEnd,
        },
      });

      await tx.payment.create({
        data: {
          tenantId: invoice.tenantId,
          invoiceId: invoice.id,
          amount: invoice.total,
          currency: invoice.currency,
          provider: parsedMethod.data,
          reference: `MANUAL-${invoice.number}-${Date.now()}`,
          status: "CONFIRMED",
          paidAt,
          createdById: session.sub,
        },
      });
    }

    await tx.subscription.update({
      where: { tenantId: invoice.tenantId },
      data: {
        status: "ACTIVE",
        currentPeriodStart: paidAt,
        currentPeriodEnd: periodEnd,
        trialEndsAt: null,
        graceEndsAt: null,
      },
    });

    await tx.tenant.update({
      where: { id: invoice.tenantId },
      data: {
        status: "ACTIVE",
        activatedAt: invoice.tenant.activatedAt ?? paidAt,
        suspendedAt: null,
      },
    });
  });

  await logPlatformEvent({
    actorId: session.sub,
    actorEmail: session.email,
    action: "PAYMENT_RECORDED",
    entityType: "Invoice",
    entityId: invoice.id,
    reason: `Paid via ${parsedMethod.data}; subscription activated`,
    afterData: { status: "PAID", subscriptionStatus: "ACTIVE", currentPeriodEnd: periodEnd },
  });

  revalidatePath("/admin/invoices");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/subscriptions");
  revalidatePath(`/admin/tenants/${invoice.tenantId}`);
  revalidatePath("/admin/tenants");
  revalidatePath("/admin");
  return { ok: true };
}

export async function activatePaidTenantAction(tenantId: string) {
  const session = await requireBillingAdmin();
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: true },
  });
  if (!tenant || !tenant.subscription) return { ok: false, error: "Tenant or subscription not found." };

  const paidInvoice = await db.invoice.findFirst({
    where: {
      tenantId,
      status: "PAID",
      OR: [{ planId: tenant.subscription.planId }, { planId: null }],
    },
    orderBy: { paidAt: "desc" },
  });
  if (!paidInvoice) {
    return { ok: false, error: "A paid invoice is required before activating a paid subscription." };
  }

  const periodStart = paidInvoice.paidAt ?? new Date();
  const periodEnd = subscriptionPeriodEnd(periodStart, tenant.subscription.billingCycle);

  await db.$transaction([
    db.subscription.update({
      where: { tenantId },
      data: {
        status: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialEndsAt: null,
        graceEndsAt: null,
      },
    }),
    db.tenant.update({
      where: { id: tenantId },
      data: { status: "ACTIVE", activatedAt: tenant.activatedAt ?? periodStart, suspendedAt: null },
    }),
  ]);

  await logPlatformEvent({
    actorId: session.sub,
    actorEmail: session.email,
    action: "SUBSCRIPTION_ACTIVATED",
    entityType: "Tenant",
    entityId: tenantId,
    reason: `Activated from paid invoice ${paidInvoice.number}`,
    afterData: { status: "ACTIVE", currentPeriodEnd: periodEnd },
  });

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/tenants");
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin");
  return { ok: true };
}
