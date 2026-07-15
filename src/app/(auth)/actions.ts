"use server";

/**
 * B-Attend auth Server Actions — login, logout, signup, contact, demo request.
 *
 * Validation: zod. Password: bcrypt via @/lib/auth/password. Session: jose JWT
 * via @/lib/auth/session. Audit: @/lib/auth/audit.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  destroySession,
  type SessionKind,
} from "@/lib/auth/session";
import { logPlatformEvent } from "@/lib/auth/audit";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || `tenant-${Date.now().toString(36)}`;
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let i = 1;
  while (await db.tenant.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${i++}`;
  }
  return candidate;
}

function getHeaders(): { userAgent?: string; ipAddress?: string } {
  // Server Actions can read headers via next/headers, but to keep this self-contained
  // we omit them in Phase 1 — Phase 2 can extend audit with real IP/UA.
  return {};
}

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────

const LoginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  next: z.string().optional(),
});

export type LoginState = { ok: false; error?: string } | { ok: true; next?: string };

export async function loginAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, password, next } = parsed.data;

  // 1. Try platform user
  const platform = await db.platformUser.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (platform && platform.status === "ACTIVE") {
    const ok = await verifyPassword(password, platform.passwordHash);
    if (ok) {
      await db.platformUser.update({
        where: { id: platform.id },
        data: { lastLoginAt: new Date() },
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
      redirect(next && next.startsWith("/") ? next : "/admin");
    }
  }

  // 2. Try tenant user (Phase 1: only if seeded in Phase 3+)
  const tenantUser = await db.user.findFirst({
    where: { email: email.toLowerCase() },
    include: { tenant: true },
  });
  if (tenantUser && tenantUser.status === "ACTIVE" && tenantUser.tenant) {
    const ok = await verifyPassword(password, tenantUser.passwordHash);
    if (ok) {
      await db.user.update({
        where: { id: tenantUser.id },
        data: { lastLoginAt: new Date() },
      });
      await createSession({
        sub: tenantUser.id,
        kind: "tenant" as SessionKind,
        role: tenantUser.role,
        name: tenantUser.name,
        email: tenantUser.email,
        tenantId: tenantUser.companyId,
      });
      // Tenant audit
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
      } catch (e) {
        console.error("[audit] tenant LOGIN failed:", e);
      }
      revalidatePath("/");
      redirect(next && next.startsWith("/") ? next : "/dashboard");
    }
  }

  return { ok: false, error: "Invalid email or password" };
}

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  await destroySession();
  revalidatePath("/");
  redirect("/login");
}

// ─────────────────────────────────────────────
// SIGNUP (Company owner request)
// ─────────────────────────────────────────────

const SignupSchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(6, "Enter a valid phone"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  companyName: z.string().min(2, "Enter your company name"),
  businessType: z.string().min(1, "Select a business type"),
  employeesCount: z.coerce.number().int().min(0).max(100000),
  branchesCount: z.coerce.number().int().min(0).max(10000),
  preferredPlanId: z.string().min(1, "Select a plan"),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]),
  city: z.string().optional(),
  message: z.string().optional(),
});

export type SignupState =
  | { ok: false; error?: string; fieldErrors?: Record<string, string> }
  | { ok: true; tenantId: string; status: string };

export async function signupAction(prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = SignupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    companyName: formData.get("companyName"),
    businessType: formData.get("businessType"),
    employeesCount: formData.get("employeesCount"),
    branchesCount: formData.get("branchesCount"),
    preferredPlanId: formData.get("preferredPlanId"),
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
  const d = parsed.data;

  // Reject if a tenant with that owner email already exists & is active
  const existing = await db.tenant.findFirst({
    where: { ownerEmail: d.email.toLowerCase(), status: { in: ["ACTIVE", "TRIAL_ACTIVE", "PENDING_ACTIVATION"] } },
  });
  if (existing) {
    return { ok: false, error: "An account with this email is already pending or active. Contact support." };
  }

  const plan = await db.plan.findUnique({ where: { id: d.preferredPlanId } });
  if (!plan) {
    return { ok: false, error: "Selected plan was not found." };
  }

  const slug = await uniqueSlug(slugify(d.companyName));

  const passwordHash = await hashPassword(d.password);

  const tenant = await db.tenant.create({
    data: {
      name: d.companyName,
      slug,
      ownerEmail: d.email.toLowerCase(),
      ownerName: d.fullName,
      ownerPhone: d.phone,
      businessType: d.businessType as any,
      employeesCount: d.employeesCount,
      branchesCount: d.branchesCount,
      city: d.city || null,
      status: "PENDING_ACTIVATION",
      preferredPlanId: plan.id,
      billingCycle: d.billingCycle,
      message: d.message || null,
    },
  });

  // Create subscription (TRIALING if Trial plan, else PENDING_PAYMENT)
  const isTrial = plan.isTrial;
  const trialEndsAt = isTrial ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null;
  await db.subscription.create({
    data: {
      tenantId: tenant.id,
      planId: plan.id,
      status: isTrial ? "TRIALING" : "PENDING_PAYMENT",
      billingCycle: d.billingCycle,
      trialEndsAt,
      currentPeriodStart: isTrial ? new Date() : null,
      currentPeriodEnd: isTrial ? trialEndsAt : null,
      monthlyAmount: plan.priceMonthly,
      annualAmount: plan.priceAnnual,
      currency: plan.currency,
    },
  });

  // Create lead so sales team can follow up
  await db.lead.create({
    data: {
      name: d.fullName,
      company: d.companyName,
      phone: d.phone,
      email: d.email.toLowerCase(),
      businessType: d.businessType as any,
      employeesCount: d.employeesCount,
      branchesCount: d.branchesCount,
      message: d.message || null,
      sourcePage: "SIGNUP",
      status: "NEW",
      tenantId: tenant.id,
    },
  });

  // Audit log
  await logPlatformEvent({
    actorEmail: d.email.toLowerCase(),
    action: "SIGNUP_REQUEST",
    entityType: "Tenant",
    entityId: tenant.id,
    reason: `Plan: ${plan.slug}, cycle: ${d.billingCycle}`,
    afterData: { tenantId: tenant.id, slug, planId: plan.id },
  });

  return { ok: true, tenantId: tenant.id, status: tenant.status };
}

// ─────────────────────────────────────────────
// CONTACT (Lead capture from /contact)
// ─────────────────────────────────────────────

const ContactSchema = z.object({
  name: z.string().min(2, "Enter your name"),
  company: z.string().optional(),
  phone: z.string().min(6, "Enter a valid phone"),
  email: z.string().email("Enter a valid email"),
  businessType: z.string().optional(),
  employeesCount: z.coerce.number().int().min(0).max(100000).optional(),
  branchesCount: z.coerce.number().int().min(0).max(10000).optional(),
  message: z.string().min(5, "Tell us a bit more (at least 5 characters)"),
});

export type ContactState =
  | { ok: false; error?: string; fieldErrors?: Record<string, string> }
  | { ok: true };

export async function contactAction(prev: ContactState, formData: FormData): Promise<ContactState> {
  const parsed = ContactSchema.safeParse({
    name: formData.get("name"),
    company: formData.get("company") || undefined,
    phone: formData.get("phone"),
    email: formData.get("email"),
    businessType: formData.get("businessType") || undefined,
    employeesCount: formData.get("employeesCount") || undefined,
    branchesCount: formData.get("branchesCount") || undefined,
    message: formData.get("message"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, fieldErrors };
  }
  const d = parsed.data;

  await db.lead.create({
    data: {
      name: d.name,
      company: d.company || null,
      phone: d.phone,
      email: d.email.toLowerCase(),
      businessType: (d.businessType as any) || null,
      employeesCount: d.employeesCount ?? null,
      branchesCount: d.branchesCount ?? null,
      message: d.message,
      sourcePage: "CONTACT",
      status: "NEW",
    },
  });

  await logPlatformEvent({
    actorEmail: d.email.toLowerCase(),
    action: "LEAD_CREATED",
    entityType: "Lead",
    reason: "Contact form submission",
  });

  return { ok: true };
}

// ─────────────────────────────────────────────
// DEMO REQUEST (Lead capture from /request-demo)
// ─────────────────────────────────────────────

const DemoSchema = z.object({
  name: z.string().min(2, "Enter your name"),
  company: z.string().min(2, "Enter your company name"),
  phone: z.string().min(6, "Enter a valid phone"),
  email: z.string().email("Enter a valid email"),
  businessType: z.string().min(1, "Select a business type"),
  employeesCount: z.coerce.number().int().min(1).max(100000),
  branchesCount: z.coerce.number().int().min(1).max(10000),
  message: z.string().optional(),
});

export type DemoState =
  | { ok: false; error?: string; fieldErrors?: Record<string, string> }
  | { ok: true };

export async function demoRequestAction(prev: DemoState, formData: FormData): Promise<DemoState> {
  const parsed = DemoSchema.safeParse({
    name: formData.get("name"),
    company: formData.get("company"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    businessType: formData.get("businessType"),
    employeesCount: formData.get("employeesCount"),
    branchesCount: formData.get("branchesCount"),
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
  const d = parsed.data;

  await db.lead.create({
    data: {
      name: d.name,
      company: d.company,
      phone: d.phone,
      email: d.email.toLowerCase(),
      businessType: d.businessType as any,
      employeesCount: d.employeesCount,
      branchesCount: d.branchesCount,
      message: d.message || null,
      sourcePage: "REQUEST_DEMO",
      status: "NEW",
    },
  });

  await logPlatformEvent({
    actorEmail: d.email.toLowerCase(),
    action: "LEAD_CREATED",
    entityType: "Lead",
    reason: "Demo request form submission",
  });

  return { ok: true };
}
