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
  getSession,
  type SessionKind,
} from "@/lib/auth/session";
import { logPlatformEvent } from "@/lib/auth/audit";
import {
  generateResetToken,
  generatePlatformResetToken,
  verifyResetToken,
  verifyPlatformResetToken,
  markTokenUsed,
  markPlatformTokenUsed,
} from "@/lib/auth/password-reset";

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

export type LoginState =
  | { ok: false; error?: string }
  | { ok: true; next?: string; forcePasswordChange?: false }
  | { ok: true; forcePasswordChange: true };

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
    // Check account lock
    if (platform.lockedUntil && platform.lockedUntil > new Date()) {
      return { ok: false, error: "Account temporarily locked. Try again later." };
    }
    const ok = await verifyPassword(password, platform.passwordHash);
    if (ok) {
      await db.platformUser.update({
        where: { id: platform.id },
        data: {
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastPasswordChangeAt: platform.lastPasswordChangeAt ?? new Date(),
        },
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
      if (platform.forcePasswordChange) {
        return { ok: true, forcePasswordChange: true };
      }
      redirect(next && next.startsWith("/") ? next : "/admin");
    }
    // Failed login — increment attempts
    const newAttempts = platform.failedLoginAttempts + 1;
    const updateData: Record<string, unknown> = { failedLoginAttempts: newAttempts };
    if (newAttempts >= 5) {
      updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    }
    await db.platformUser.update({ where: { id: platform.id }, data: updateData });
  }

  // 2. Try tenant user (Phase 1: only if seeded in Phase 3+)
  const tenantUser = await db.user.findFirst({
    where: { email: email.toLowerCase() },
    include: { tenant: true },
  });
  if (tenantUser && tenantUser.status === "ACTIVE" && tenantUser.tenant) {
    // Check account lock
    if (tenantUser.lockedUntil && tenantUser.lockedUntil > new Date()) {
      return { ok: false, error: "Account temporarily locked. Try again later." };
    }
    const ok = await verifyPassword(password, tenantUser.passwordHash);
    if (ok) {
      await db.user.update({
        where: { id: tenantUser.id },
        data: {
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastPasswordChangeAt: tenantUser.lastPasswordChangeAt ?? new Date(),
        },
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
      if (tenantUser.forcePasswordChange) {
        return { ok: true, forcePasswordChange: true };
      }
      redirect(next && next.startsWith("/") ? next : "/dashboard");
    }
    // Failed login — increment attempts
    const newAttempts = tenantUser.failedLoginAttempts + 1;
    const updateData: Record<string, unknown> = { failedLoginAttempts: newAttempts };
    if (newAttempts >= 5) {
      updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    }
    await db.user.update({ where: { id: tenantUser.id }, data: updateData });
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

// ─────────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────────

const ForgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export type ForgotPasswordState =
  | { ok: false; error?: string }
  | { ok: true; message: string };

export async function forgotPasswordAction(
  prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = ForgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const email = parsed.data.email.toLowerCase();
  const resetUrlBase = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // 1. Check platform users
  const platformUser = await db.platformUser.findUnique({
    where: { email },
  });
  if (platformUser) {
    try {
      const token = await generatePlatformResetToken(platformUser.id);
      const url = `${resetUrlBase}/reset-password?token=${token}&userId=${platformUser.id}`;
      console.log(`[DEV] Platform reset URL: ${url}`);
    } catch (e) {
      console.error("[forgot-password] Platform token error:", e);
    }
    return {
      ok: true,
      message:
        "If an account exists with this email, a reset link has been sent.",
    };
  }

  // 2. Check tenant users
  const tenantUser = await db.user.findFirst({
    where: { email },
  });
  if (tenantUser) {
    try {
      const token = await generateResetToken(tenantUser.id);
      const url = `${resetUrlBase}/reset-password?token=${token}&userId=${tenantUser.id}`;
      console.log(`[DEV] Tenant reset URL: ${url}`);
    } catch (e) {
      console.error("[forgot-password] Tenant token error:", e);
    }
    return {
      ok: true,
      message:
        "If an account exists with this email, a reset link has been sent.",
    };
  }

  // 3. No user found — return same message (no enumeration)
  return {
    ok: true,
    message:
      "If an account exists with this email, a reset link has been sent.",
  };
}

// ─────────────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────────────

const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, "Token is required"),
    userId: z.string().min(1, "User ID is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordState =
  | { ok: false; error?: string }
  | { ok: true; message: string };

export async function resetPasswordAction(
  prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = ResetPasswordSchema.safeParse({
    token: formData.get("token"),
    userId: formData.get("userId"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { token, userId, newPassword } = parsed.data;

  // 1. Try platform user first
  const platformUser = await db.platformUser.findUnique({
    where: { id: userId },
  });
  if (platformUser) {
    const result = await verifyPlatformResetToken(token, userId);
    if (!result.valid) {
      return { ok: false, error: result.error ?? "Invalid token" };
    }

    const passwordHash = await hashPassword(newPassword);
    await db.platformUser.update({
      where: { id: userId },
      data: {
        passwordHash,
        forcePasswordChange: false,
        lastPasswordChangeAt: new Date(),
      },
    });

    if (result.tokenId) {
      await markPlatformTokenUsed(result.tokenId);
    }

    await logPlatformEvent({
      actorId: platformUser.id,
      actorEmail: platformUser.email,
      action: "PASSWORD_RESET",
      entityType: "PlatformUser",
      entityId: platformUser.id,
    });

    return { ok: true, message: "Password reset successful. You can now log in." };
  }

  // 2. Try tenant user
  const tenantUser = await db.user.findUnique({
    where: { id: userId },
  });
  if (tenantUser) {
    const result = await verifyResetToken(token, userId);
    if (!result.valid) {
      return { ok: false, error: result.error ?? "Invalid token" };
    }

    const passwordHash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        forcePasswordChange: false,
        lastPasswordChangeAt: new Date(),
      },
    });

    if (result.tokenId) {
      await markTokenUsed(result.tokenId);
    }

    // Tenant audit
    try {
      await db.auditLog.create({
        data: {
          companyId: tenantUser.companyId,
          actorId: tenantUser.id,
          actorEmail: tenantUser.email,
          action: "PASSWORD_RESET",
          entityType: "User",
          entityId: tenantUser.id,
        },
      });
    } catch (e) {
      console.error("[audit] tenant PASSWORD_RESET failed:", e);
    }

    return { ok: true, message: "Password reset successful. You can now log in." };
  }

  return { ok: false, error: "Invalid user" };
}

// ─────────────────────────────────────────────
// CHANGE PASSWORD
// ─────────────────────────────────────────────

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
});

export type ChangePasswordState =
  | { ok: false; error?: string; fieldErrors?: Record<string, string> }
  | { ok: true };

export async function changePasswordAction(
  prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, fieldErrors };
  }
  const { currentPassword, newPassword, confirmPassword } = parsed.data;

  if (newPassword !== confirmPassword) {
    return { ok: false, error: "New passwords do not match" };
  }

  const session = await getSession();
  if (!session) {
    return { ok: false, error: "You must be logged in to change your password" };
  }

  if (session.kind === "platform") {
    const platform = await db.platformUser.findUnique({ where: { id: session.sub } });
    if (!platform) {
      return { ok: false, error: "User not found" };
    }
    const valid = await verifyPassword(currentPassword, platform.passwordHash);
    if (!valid) {
      return { ok: false, error: "Current password is incorrect" };
    }
    const passwordHash = await hashPassword(newPassword);
    await db.platformUser.update({
      where: { id: platform.id },
      data: {
        passwordHash,
        forcePasswordChange: false,
        lastPasswordChangeAt: new Date(),
      },
    });
  } else {
    const tenantUser = await db.user.findUnique({ where: { id: session.sub } });
    if (!tenantUser) {
      return { ok: false, error: "User not found" };
    }
    const valid = await verifyPassword(currentPassword, tenantUser.passwordHash);
    if (!valid) {
      return { ok: false, error: "Current password is incorrect" };
    }
    const passwordHash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: tenantUser.id },
      data: {
        passwordHash,
        forcePasswordChange: false,
        lastPasswordChangeAt: new Date(),
      },
    });
  }

  // Force re-login with new password
  await destroySession();
  revalidatePath("/");
  redirect("/login?reason=loggedout");
}
