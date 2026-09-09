"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, type SessionKind } from "@/lib/auth/session";
import { logPlatformEvent } from "@/lib/auth/audit";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "company";
}

function isLiveSubscription(input: {
  tenantStatus: string;
  subscriptionStatus: string | null;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
  currentPeriodEnd: Date | null;
}): boolean {
  const now = Date.now();
  if (!new Set(["TRIAL_ACTIVE", "ACTIVE"]).has(input.tenantStatus)) return false;
  if (!input.subscriptionStatus || !new Set(["TRIALING", "ACTIVE", "GRACE_PERIOD"]).has(input.subscriptionStatus)) return false;
  if (input.subscriptionStatus === "TRIALING" && input.trialEndsAt && input.trialEndsAt.getTime() <= now) return false;
  if (input.subscriptionStatus === "GRACE_PERIOD" && input.graceEndsAt && input.graceEndsAt.getTime() <= now) return false;
  if (input.subscriptionStatus === "ACTIVE" && input.currentPeriodEnd && input.currentPeriodEnd.getTime() <= now) return false;
  return true;
}

const LoginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  next: z.string().optional(),
});

export type LaunchLoginState =
  | { ok: false; error?: string }
  | { ok: true; next?: string; forcePasswordChange?: false }
  | { ok: true; forcePasswordChange: true };

export async function launchLoginAction(
  _prev: LaunchLoginState,
  formData: FormData,
): Promise<LaunchLoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { email, password, next } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const platform = await db.platformUser.findUnique({ where: { email: normalizedEmail } });
  if (platform && platform.status === "ACTIVE") {
    if (platform.lockedUntil && platform.lockedUntil > new Date()) {
      return { ok: false, error: "Account temporarily locked. Try again later." };
    }
    const passwordOk = await verifyPassword(password, platform.passwordHash);
    if (passwordOk) {
      await db.platformUser.update({
        where: { id: platform.id },
        data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
      });
      await createSession({
        sub: platform.id,
        kind: "platform" as SessionKind,
        role: platform.role,
        name: platform.name,
        email: platform.email,
      });
      await logPlatformEvent({
        actorId: platform.id,
        actorEmail: platform.email,
        action: "LOGIN",
        entityType: "PlatformUser",
        entityId: platform.id,
      });
      revalidatePath("/");
      if (platform.forcePasswordChange) return { ok: true, forcePasswordChange: true };
      redirect(next && next.startsWith("/") ? next : "/admin");
    }

    const attempts = platform.failedLoginAttempts + 1;
    await db.platformUser.update({
      where: { id: platform.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : platform.lockedUntil,
      },
    });
    return { ok: false, error: "Invalid email or password" };
  }

  const tenantUser = await db.user.findFirst({
    where: { email: normalizedEmail, deletedAt: null },
    include: { tenant: { include: { subscription: true } } },
  });

  if (!tenantUser || tenantUser.status !== "ACTIVE" || !tenantUser.tenant) {
    return { ok: false, error: "Invalid email or password" };
  }
  if (tenantUser.lockedUntil && tenantUser.lockedUntil > new Date()) {
    return { ok: false, error: "Account temporarily locked. Try again later." };
  }

  const passwordOk = await verifyPassword(password, tenantUser.passwordHash);
  if (!passwordOk) {
    const attempts = tenantUser.failedLoginAttempts + 1;
    await db.user.update({
      where: { id: tenantUser.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : tenantUser.lockedUntil,
      },
    });
    return { ok: false, error: "Invalid email or password" };
  }

  const subscription = tenantUser.tenant.subscription;
  const live = isLiveSubscription({
    tenantStatus: tenantUser.tenant.status,
    subscriptionStatus: subscription?.status ?? null,
    trialEndsAt: subscription?.trialEndsAt ?? null,
    graceEndsAt: subscription?.graceEndsAt ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
  });

  // When billing is inactive, only the company owner receives a restricted
  // signed session. getSession() will reject it for normal product operations,
  // while /billing and /support intentionally use getSessionAllowInactive().
  if (!live && tenantUser.role !== "COMPANY_OWNER") {
    return {
      ok: false,
      error: "Your company's subscription is not active. Ask the company owner to complete billing activation.",
    };
  }

  await db.user.update({
    where: { id: tenantUser.id },
    data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
  });
  await createSession({
    sub: tenantUser.id,
    kind: "tenant" as SessionKind,
    role: tenantUser.role,
    name: tenantUser.name,
    email: tenantUser.email,
    tenantId: tenantUser.companyId,
  });
  try {
    await db.auditLog.create({
      data: {
        companyId: tenantUser.companyId,
        actorId: tenantUser.id,
        actorEmail: tenantUser.email,
        action: "LOGIN",
        entityType: "User",
        entityId: tenantUser.id,
      },
    });
  } catch (error) {
    console.error("[audit] tenant LOGIN failed:", error);
  }

  revalidatePath("/");
  if (!live) redirect("/billing?reason=subscription");
  if (tenantUser.forcePasswordChange) return { ok: true, forcePasswordChange: true };
  redirect(next && next.startsWith("/") ? next : "/dashboard");
}

const BusinessTypeSchema = z.enum([
  "RESTAURANT",
  "CAFE",
  "CLOUD_KITCHEN",
  "CENTRAL_KITCHEN",
  "RETAIL_CHAIN",
  "GYM",
  "CLINIC",
  "WAREHOUSE",
  "SECURITY_COMPANY",
  "CLEANING_COMPANY",
  "MULTI_BRANCH_OPS",
  "OTHER",
]);

const SignupSchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(6, "Enter a valid phone"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  companyName: z.string().min(2, "Enter your company name"),
  businessType: BusinessTypeSchema,
  employeesCount: z.coerce.number().int().min(0).max(100000),
  branchesCount: z.coerce.number().int().min(0).max(10000),
  preferredPlanSlug: z.string().min(1, "Select a plan"),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]),
  city: z.string().optional(),
  message: z.string().optional(),
});

export type LaunchSignupState =
  | { ok: false; error?: string; fieldErrors?: Record<string, string> }
  | { ok: true; tenantId: string; status: string; canLogin: boolean; planSlug: string; invoiceNumber?: string };

export async function launchSignupAction(
  _prev: LaunchSignupState,
  formData: FormData,
): Promise<LaunchSignupState> {
  const parsed = SignupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    companyName: formData.get("companyName"),
    businessType: formData.get("businessType"),
    employeesCount: formData.get("employeesCount"),
    branchesCount: formData.get("branchesCount"),
    preferredPlanSlug: formData.get("preferredPlanSlug"),
    billingCycle: formData.get("billingCycle"),
    city: formData.get("city") || undefined,
    message: formData.get("message") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, fieldErrors };
  }

  const input = parsed.data;
  const email = input.email.toLowerCase();
  const plan = await db.plan.findUnique({ where: { slug: input.preferredPlanSlug } });
  if (!plan || !plan.isActive) return { ok: false, error: "Selected plan is not available." };
  if (plan.isCustom) return { ok: false, error: "Enterprise plans require a sales-assisted setup. Please contact sales." };

  const selectedAmount = input.billingCycle === "ANNUAL" ? plan.priceAnnual : plan.priceMonthly;
  if (!plan.isTrial && selectedAmount <= 0) return { ok: false, error: "Selected paid plan has an invalid price." };

  if (!plan.isTrial && (input.employeesCount > plan.maxEmployees || input.branchesCount > plan.maxBranches)) {
    return {
      ok: false,
      error: `Selected plan supports up to ${plan.maxEmployees} employees and ${plan.maxBranches} branches. Choose a larger plan.`,
    };
  }

  const [existingTenant, existingUser, existingPlatformUser] = await Promise.all([
    db.tenant.findFirst({
      where: {
        ownerEmail: email,
        deletedAt: null,
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
      select: { id: true },
    }),
    db.user.findFirst({ where: { email, deletedAt: null }, select: { id: true } }),
    db.platformUser.findUnique({ where: { email }, select: { id: true } }),
  ]);
  if (existingTenant || existingUser || existingPlatformUser) {
    return { ok: false, error: "An account with this email already exists or is awaiting activation." };
  }

  const settings = await db.systemSetting.findUnique({ where: { isMain: true } });
  const trialDays = Math.max(1, settings?.defaultTrialDays ?? 14);
  const now = new Date();
  const trialEndsAt = plan.isTrial ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;
  const passwordHash = await hashPassword(input.password);
  const slug = `${slugify(input.companyName)}-${Date.now().toString(36).slice(-6)}`;

  const result = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.companyName,
        slug,
        ownerEmail: email,
        ownerName: input.fullName,
        ownerPhone: input.phone,
        businessType: input.businessType,
        employeesCount: input.employeesCount,
        branchesCount: input.branchesCount,
        city: input.city || null,
        status: plan.isTrial ? "TRIAL_ACTIVE" : "PENDING_ACTIVATION",
        preferredPlanId: plan.id,
        billingCycle: input.billingCycle,
        message: input.message || null,
        activatedAt: plan.isTrial ? now : null,
      },
    });

    const subscription = await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: plan.isTrial ? "TRIALING" : "PENDING_PAYMENT",
        billingCycle: input.billingCycle,
        trialEndsAt,
        currentPeriodStart: plan.isTrial ? now : null,
        currentPeriodEnd: plan.isTrial ? trialEndsAt : null,
        monthlyAmount: plan.priceMonthly,
        annualAmount: plan.priceAnnual,
        currency: plan.currency,
      },
    });

    const owner = await tx.user.create({
      data: {
        companyId: tenant.id,
        email,
        passwordHash,
        name: input.fullName,
        role: "COMPANY_OWNER",
        status: "ACTIVE",
        forcePasswordChange: false,
        lastPasswordChangeAt: now,
      },
    });

    await tx.lead.create({
      data: {
        name: input.fullName,
        company: input.companyName,
        phone: input.phone,
        email,
        businessType: input.businessType,
        employeesCount: input.employeesCount,
        branchesCount: input.branchesCount,
        message: input.message || null,
        sourcePage: "SIGNUP",
        status: plan.isTrial ? "QUALIFIED" : "NEW",
        tenantId: tenant.id,
      },
    });

    let invoiceNumber: string | undefined;
    if (!plan.isTrial) {
      invoiceNumber = `INV-${tenant.slug.toUpperCase()}-001`;
      await tx.invoice.create({
        data: {
          tenantId: tenant.id,
          subscriptionId: subscription.id,
          planId: plan.id,
          number: invoiceNumber,
          subtotal: selectedAmount,
          discount: 0,
          tax: 0,
          total: selectedAmount,
          currency: plan.currency,
          status: "PENDING_PAYMENT",
          dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
          notes: "Created automatically from public signup.",
        },
      });
    }

    return { tenant, owner, invoiceNumber };
  });

  await logPlatformEvent({
    actorEmail: email,
    action: "SIGNUP_REQUEST",
    entityType: "Tenant",
    entityId: result.tenant.id,
    reason: `Plan: ${plan.slug}, cycle: ${input.billingCycle}`,
    afterData: {
      tenantId: result.tenant.id,
      slug,
      planId: plan.id,
      ownerUserId: result.owner.id,
      invoiceNumber: result.invoiceNumber ?? null,
      selfActivatedTrial: plan.isTrial,
    },
  });

  return {
    ok: true,
    tenantId: result.tenant.id,
    status: result.tenant.status,
    canLogin: true,
    planSlug: plan.slug,
    invoiceNumber: result.invoiceNumber,
  };
}
