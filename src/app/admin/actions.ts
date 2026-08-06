"use server";

/**
 * B-Attend Super Admin Server Actions — Phase 2.
 *
 * All actions enforce platform role checks and write to PlatformAuditLog.
 * Tenant-scoped actions (e.g. impersonation) also create the appropriate audit trail.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession, createSession, type SessionKind } from "@/lib/auth/session";
import { logPlatformEvent } from "@/lib/auth/audit";

async function requirePlatform(...roles: string[]) {
  const s = await getSession();
  if (!s || s.kind !== "platform") throw new Error("FORBIDDEN");
  if (roles.length > 0 && !roles.includes(s.role)) throw new Error("FORBIDDEN");
  return s;
}

// ─────────────────────────────────────────────
// Tenant lifecycle
// ─────────────────────────────────────────────

export async function activateTenantAction(tenantId: string) {
  const s = await requirePlatform("SUPER_ADMIN", "BILLING_ADMIN", "SALES_ADMIN");
  const t = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!t) return { ok: false, error: "Tenant not found" };
  await db.tenant.update({ where: { id: tenantId }, data: { status: "ACTIVE", activatedAt: new Date() } });
  await db.subscription.updateMany({ where: { tenantId }, data: { status: "ACTIVE" } });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "SUBSCRIPTION_ACTIVATED", entityType: "Tenant", entityId: tenantId, reason: "Manual activation", afterData: { status: "ACTIVE" } });
  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function activateTrialAction(tenantId: string) {
  const s = await requirePlatform("SUPER_ADMIN", "SALES_ADMIN");
  const t = await db.tenant.findUnique({ where: { id: tenantId }, include: { subscription: true } });
  if (!t) return { ok: false, error: "Tenant not found" };
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await db.tenant.update({ where: { id: tenantId }, data: { status: "TRIAL_ACTIVE", activatedAt: new Date() } });
  if (t.subscription) {
    await db.subscription.update({ where: { tenantId }, data: { status: "TRIALING", trialEndsAt, currentPeriodStart: new Date(), currentPeriodEnd: trialEndsAt } });
  }
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "SUBSCRIPTION_ACTIVATED", entityType: "Tenant", entityId: tenantId, reason: "Trial activated", afterData: { status: "TRIAL_ACTIVE", trialEndsAt } });
  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function suspendTenantAction(tenantId: string, reason: string) {
  const s = await requirePlatform("SUPER_ADMIN", "BILLING_ADMIN");
  const t = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!t) return { ok: false, error: "Tenant not found" };
  await db.tenant.update({ where: { id: tenantId }, data: { status: "SUSPENDED", suspendedAt: new Date() } });
  await db.subscription.updateMany({ where: { tenantId }, data: { status: "SUSPENDED" } });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "SUBSCRIPTION_SUSPENDED", entityType: "Tenant", entityId: tenantId, reason });
  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function reactivateTenantAction(tenantId: string) {
  const s = await requirePlatform("SUPER_ADMIN", "BILLING_ADMIN");
  const t = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!t) return { ok: false, error: "Tenant not found" };
  await db.tenant.update({ where: { id: tenantId }, data: { status: "ACTIVE", suspendedAt: null } });
  await db.subscription.updateMany({ where: { tenantId }, data: { status: "ACTIVE" } });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "SUBSCRIPTION_ACTIVATED", entityType: "Tenant", entityId: tenantId, reason: "Reactivated after suspension" });
  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function cancelTenantAction(tenantId: string, reason: string) {
  const s = await requirePlatform("SUPER_ADMIN");
  const t = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!t) return { ok: false, error: "Tenant not found" };
  await db.tenant.update({ where: { id: tenantId }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  await db.subscription.updateMany({ where: { tenantId }, data: { status: "CANCELLED" } });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "SUBSCRIPTION_SUSPENDED", entityType: "Tenant", entityId: tenantId, reason: `Cancelled: ${reason}` });
  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function rejectTenantAction(tenantId: string, reason: string) {
  const s = await requirePlatform("SUPER_ADMIN", "SALES_ADMIN");
  const t = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!t) return { ok: false, error: "Tenant not found" };
  await db.tenant.update({ where: { id: tenantId }, data: { status: "REJECTED", rejectedAt: new Date() } });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "TENANT_REJECTED", entityType: "Tenant", entityId: tenantId, reason });
  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin");
  return { ok: true };
}

// ─────────────────────────────────────────────
// Subscription / plan changes
// ─────────────────────────────────────────────

const ChangePlanSchema = z.object({
  tenantId: z.string(),
  planId: z.string(),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]),
});

export async function changePlanAction(prev: unknown, formData: FormData) {
  const s = await requirePlatform("SUPER_ADMIN", "BILLING_ADMIN");
  const parsed = ChangePlanSchema.safeParse({
    tenantId: formData.get("tenantId"),
    planId: formData.get("planId"),
    billingCycle: formData.get("billingCycle"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const { tenantId, planId, billingCycle } = parsed.data;
  const plan = await db.plan.findUnique({ where: { id: planId } });
  if (!plan) return { ok: false, error: "Plan not found" };
  const sub = await db.subscription.findUnique({ where: { tenantId } });
  if (!sub) return { ok: false, error: "Subscription not found" };
  const before = { planId: sub.planId, billingCycle: sub.billingCycle };
  await db.subscription.update({
    where: { tenantId },
    data: {
      planId,
      billingCycle,
      monthlyAmount: plan.priceMonthly,
      annualAmount: plan.priceAnnual,
      currency: plan.currency,
    },
  });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "PLAN_CHANGED", entityType: "Subscription", entityId: sub.id, reason: `Plan changed by admin`, beforeData: before, afterData: { planId, billingCycle } });
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin/subscriptions");
  return { ok: true };
}

export async function extendTrialAction(tenantId: string, days: number) {
  const s = await requirePlatform("SUPER_ADMIN", "BILLING_ADMIN");
  const sub = await db.subscription.findUnique({ where: { tenantId } });
  if (!sub) return { ok: false, error: "Subscription not found" };
  const base = sub.trialEndsAt ?? new Date();
  const newEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  await db.subscription.update({ where: { tenantId }, data: { trialEndsAt: newEnd, currentPeriodEnd: newEnd } });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "PLAN_CHANGED", entityType: "Subscription", entityId: sub.id, reason: `Trial extended by ${days} days`, afterData: { trialEndsAt: newEnd } });
  revalidatePath(`/admin/tenants/${tenantId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────
// Invoices & payments
// ─────────────────────────────────────────────

const CreateInvoiceSchema = z.object({
  tenantId: z.string(),
  planId: z.string().optional(),
  subtotal: z.coerce.number().int().min(0),
  discount: z.coerce.number().int().min(0).default(0),
  tax: z.coerce.number().int().min(0).default(0),
  total: z.coerce.number().int().min(0),
  currency: z.string().default("EGP"),
  dueDate: z.string().min(1),
  notes: z.string().optional(),
});

export async function createInvoiceAction(prev: unknown, formData: FormData) {
  const s = await requirePlatform("SUPER_ADMIN", "BILLING_ADMIN");
  const parsed = CreateInvoiceSchema.safeParse({
    tenantId: formData.get("tenantId"),
    planId: formData.get("planId") || undefined,
    subtotal: formData.get("subtotal"),
    discount: formData.get("discount") || 0,
    tax: formData.get("tax") || 0,
    total: formData.get("total"),
    currency: formData.get("currency") || "EGP",
    dueDate: formData.get("dueDate"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const tenant = await db.tenant.findUnique({ where: { id: d.tenantId }, include: { subscription: true } });
  if (!tenant) return { ok: false, error: "Tenant not found" };
  const count = await db.invoice.count({ where: { tenantId: d.tenantId } });
  const number = `INV-${tenant.slug.toUpperCase()}-${String(count + 1).padStart(3, "0")}`;
  const inv = await db.invoice.create({
    data: {
      tenantId: d.tenantId,
      subscriptionId: tenant.subscription?.id,
      planId: d.planId || tenant.subscription?.planId,
      number,
      billingPeriodStart: new Date(),
      billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: d.subtotal,
      discount: d.discount,
      tax: d.tax,
      total: d.total,
      currency: d.currency,
      status: "ISSUED",
      dueDate: new Date(d.dueDate),
      notes: d.notes,
      createdById: s.sub,
    },
  });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "INVOICE_CREATED", entityType: "Invoice", entityId: inv.id, afterData: { number, total: d.total } });
  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/tenants/${d.tenantId}`);
  return { ok: true };
}

export async function markInvoicePaidAction(invoiceId: string, paymentMethod: string) {
  const s = await requirePlatform("SUPER_ADMIN", "BILLING_ADMIN");
  const inv = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return { ok: false, error: "Invoice not found" };
  await db.invoice.update({ where: { id: invoiceId }, data: { status: "PAID", paidAt: new Date(), paymentMethod } });
  await db.payment.create({ data: { tenantId: inv.tenantId, invoiceId, amount: inv.total, currency: inv.currency, provider: "MANUAL", reference: `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, status: "CONFIRMED", paidAt: new Date(), createdById: s.sub } });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "PAYMENT_RECORDED", entityType: "Invoice", entityId: invoiceId, reason: `Marked paid via ${paymentMethod}`, afterData: { status: "PAID" } });
  revalidatePath("/admin/invoices");
  revalidatePath("/admin/payments");
  revalidatePath(`/admin/tenants/${inv.tenantId}`);
  return { ok: true };
}

export async function voidInvoiceAction(invoiceId: string) {
  const s = await requirePlatform("SUPER_ADMIN", "BILLING_ADMIN");
  const inv = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return { ok: false, error: "Invoice not found" };
  await db.invoice.update({ where: { id: invoiceId }, data: { status: "VOID" } });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "INVOICE_VOIDED", entityType: "Invoice", entityId: invoiceId });
  revalidatePath("/admin/invoices");
  return { ok: true };
}

// ─────────────────────────────────────────────
// Leads
// ─────────────────────────────────────────────

export async function updateLeadStatusAction(leadId: string, status: string) {
  const s = await requirePlatform("SUPER_ADMIN", "SALES_ADMIN");
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false, error: "Lead not found" };
  await db.lead.update({ where: { id: leadId }, data: { status: status as any, assignedToId: s.sub } });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "LEAD_UPDATED", entityType: "Lead", entityId: leadId, afterData: { status } });
  revalidatePath("/admin/leads");
  return { ok: true };
}

export async function assignLeadAction(leadId: string, assignedToId: string) {
  const s = await requirePlatform("SUPER_ADMIN", "SALES_ADMIN");
  await db.lead.update({ where: { id: leadId }, data: { assignedToId: assignedToId || null } });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "LEAD_ASSIGNED", entityType: "Lead", entityId: leadId, afterData: { assignedToId } });
  revalidatePath("/admin/leads");
  return { ok: true };
}

// ─────────────────────────────────────────────
// Impersonation
// ─────────────────────────────────────────────

export async function impersonateTenantOwnerAction(tenantId: string, reason: string) {
  const s = await requirePlatform("SUPER_ADMIN", "SUPPORT_AGENT");
  if (!reason || reason.length < 5) return { ok: false, error: "Reason must be at least 5 characters" };
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { ok: false, error: "Tenant not found" };
  // Find tenant owner user
  const owner = await db.user.findUnique({ where: { companyId_email: { companyId: tenantId, email: tenant.ownerEmail } } });
  if (!owner) return { ok: false, error: "Owner user not found" };
  // Create new session as tenant user
  await createSession({
    sub: owner.id,
    kind: "tenant" as SessionKind,
    role: owner.role,
    name: owner.name,
    email: owner.email,
    tenantId: owner.companyId,
  });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "TENANT_IMPERSONATED", entityType: "Tenant", entityId: tenantId, reason });
  revalidatePath("/");
  redirect("/dashboard");
}

// ─────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────

const SettingsSchema = z.object({
  defaultTrialDays: z.coerce.number().int().min(1).max(90),
  defaultGracePeriodDays: z.coerce.number().int().min(1).max(60),
  defaultCurrency: z.string().min(1),
  manualActivationMode: z.enum(["true", "false"]).or(z.boolean()),
  supportEmail: z.string().email(),
  billingEmail: z.string().email(),
  maintenanceMode: z.enum(["true", "false"]).or(z.boolean()),
  paymentProviderMode: z.enum(["MANUAL", "STRIPE", "PAYMOB", "FAWRY"]),
  defaultPlanId: z.string().optional(),
});

export async function updateSettingsAction(prev: any, formData: FormData) {
  const s = await requirePlatform("SUPER_ADMIN");
  const parsed = SettingsSchema.safeParse({
    defaultTrialDays: formData.get("defaultTrialDays"),
    defaultGracePeriodDays: formData.get("defaultGracePeriodDays"),
    defaultCurrency: formData.get("defaultCurrency"),
    manualActivationMode: formData.get("manualActivationMode") ?? "false",
    supportEmail: formData.get("supportEmail"),
    billingEmail: formData.get("billingEmail"),
    maintenanceMode: formData.get("maintenanceMode") ?? "false",
    paymentProviderMode: formData.get("paymentProviderMode"),
    defaultPlanId: formData.get("defaultPlanId") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  await db.systemSetting.update({ where: { isMain: true }, data: {
    defaultTrialDays: d.defaultTrialDays,
    defaultGracePeriodDays: d.defaultGracePeriodDays,
    defaultCurrency: d.defaultCurrency,
    manualActivationMode: d.manualActivationMode === true || d.manualActivationMode === "true",
    supportEmail: d.supportEmail,
    billingEmail: d.billingEmail,
    maintenanceMode: d.maintenanceMode === true || d.maintenanceMode === "true",
    paymentProviderMode: d.paymentProviderMode,
    defaultPlanId: d.defaultPlanId || null,
  }});
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "SETTINGS_UPDATED", entityType: "SystemSetting", entityId: "main", afterData: d });
  revalidatePath("/admin/settings");
  return { ok: true };
}

// ─────────────────────────────────────────────
// Plan management
// ─────────────────────────────────────────────

const UpdatePlanSchema = z.object({
  planId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  priceMonthly: z.coerce.number().int().min(0),
  priceAnnual: z.coerce.number().int().min(0),
  maxBranches: z.coerce.number().int().min(0),
  maxEmployees: z.coerce.number().int().min(0),
  maxManagers: z.coerce.number().int().min(0),
  maxKiosks: z.coerce.number().int().min(0),
  auditRetentionDays: z.coerce.number().int().min(1),
  reportsLevel: z.enum(["BASIC", "ADVANCED"]),
  supportLevel: z.enum(["SELF_SERVICE", "STANDARD", "PRIORITY"]),
  isActive: z.enum(["true", "false"]).or(z.boolean()),
});

export async function updatePlanAction(prev: any, formData: FormData) {
  const s = await requirePlatform("SUPER_ADMIN", "BILLING_ADMIN");
  const parsed = UpdatePlanSchema.safeParse({
    planId: formData.get("planId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    priceMonthly: formData.get("priceMonthly"),
    priceAnnual: formData.get("priceAnnual"),
    maxBranches: formData.get("maxBranches"),
    maxEmployees: formData.get("maxEmployees"),
    maxManagers: formData.get("maxManagers"),
    maxKiosks: formData.get("maxKiosks"),
    auditRetentionDays: formData.get("auditRetentionDays"),
    reportsLevel: formData.get("reportsLevel"),
    supportLevel: formData.get("supportLevel"),
    isActive: formData.get("isActive") ?? "true",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  await db.plan.update({ where: { id: d.planId }, data: {
    name: d.name,
    description: d.description,
    priceMonthly: d.priceMonthly,
    priceAnnual: d.priceAnnual,
    maxBranches: d.maxBranches,
    maxEmployees: d.maxEmployees,
    maxManagers: d.maxManagers,
    maxKiosks: d.maxKiosks,
    auditRetentionDays: d.auditRetentionDays,
    reportsLevel: d.reportsLevel,
    supportLevel: d.supportLevel,
    isActive: d.isActive === true || d.isActive === "true",
  }});
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "PLAN_UPDATED", entityType: "Plan", entityId: d.planId });
  revalidatePath("/admin/plans");
  revalidatePath(`/admin/plans/${d.planId}`);
  return { ok: true };
}

export async function togglePlanFeatureAction(planId: string, featureKey: string, enabled: boolean) {
  const s = await requirePlatform("SUPER_ADMIN", "BILLING_ADMIN");
  await db.planFeature.update({ where: { planId_key: { planId, key: featureKey } }, data: { enabled } });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "PLAN_UPDATED", entityType: "PlanFeature", entityId: `${planId}:${featureKey}`, afterData: { enabled } });
  revalidatePath(`/admin/plans/${planId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────
// Support tickets
// ─────────────────────────────────────────────

const ReplyTicketSchema = z.object({
  ticketId: z.string(),
  body: z.string().min(1),
  status: z.string().optional(),
  isInternal: z.enum(["true", "false"]).or(z.boolean()).default(false),
});

export async function replyTicketAction(prev: any, formData: FormData) {
  const s = await requirePlatform("SUPER_ADMIN", "SUPPORT_AGENT");
  const parsed = ReplyTicketSchema.safeParse({
    ticketId: formData.get("ticketId"),
    body: formData.get("body"),
    status: formData.get("status") || undefined,
    isInternal: formData.get("isInternal") ?? "false",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  await db.supportMessage.create({
    data: {
      ticketId: d.ticketId,
      authorId: s.sub,
      authorEmail: s.email,
      authorRole: s.role,
      body: d.body,
      isInternal: d.isInternal === true || d.isInternal === "true",
    },
  });
  if (d.status) {
    await db.supportTicket.update({ where: { id: d.ticketId }, data: { status: d.status as any, assignedToId: s.sub } });
  } else {
    await db.supportTicket.update({ where: { id: d.ticketId }, data: { status: "WAITING_CUSTOMER", assignedToId: s.sub } });
  }
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "SUPPORT_REPLIED", entityType: "SupportTicket", entityId: d.ticketId });
  revalidatePath(`/admin/support/${d.ticketId}`);
  revalidatePath("/admin/support");
  return { ok: true };
}

export async function updateTicketStatusAction(ticketId: string, status: string) {
  const s = await requirePlatform("SUPER_ADMIN", "SUPPORT_AGENT");
  await db.supportTicket.update({ where: { id: ticketId }, data: { status: status as any } });
  await logPlatformEvent({ actorId: s.sub, actorEmail: s.email, action: "SUPPORT_STATUS_CHANGED", entityType: "SupportTicket", entityId: ticketId, afterData: { status } });
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticketId}`);
  return { ok: true };
}
