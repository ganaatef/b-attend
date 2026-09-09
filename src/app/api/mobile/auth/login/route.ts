import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createMobileSessionToken } from "@/lib/auth/session";
import { requireActiveSubscription } from "@/lib/auth/tenant";

const LoginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(256),
  workspace: z.string().trim().min(1).max(100).optional(),
});

const LOCK_AFTER_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function POST(request: NextRequest) {
  const parsed = LoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 400 });

  const candidates = await db.user.findMany({
    where: {
      email: parsed.data.email,
      role: "EMPLOYEE",
      status: "ACTIVE",
      deletedAt: null,
      employeeId: { not: null },
      ...(parsed.data.workspace
        ? { tenant: { slug: parsed.data.workspace, deletedAt: null } }
        : {}),
    },
    include: {
      employee: true,
      tenant: { select: { slug: true } },
    },
    take: parsed.data.workspace ? 1 : 5,
  });

  if (candidates.length === 0) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const now = new Date();
  const validCandidates = [] as typeof candidates;
  for (const candidate of candidates) {
    if (candidate.lockedUntil && candidate.lockedUntil > now) continue;
    if (!candidate.employee || candidate.employee.status !== "ACTIVE" || candidate.employee.deletedAt) continue;
    if (await verifyPassword(parsed.data.password, candidate.passwordHash)) validCandidates.push(candidate);
  }

  if (validCandidates.length === 0) {
    if (candidates.length === 1) {
      const candidate = candidates[0];
      const attempts = candidate.failedLoginAttempts + 1;
      await db.user.update({
        where: { id: candidate.id },
        data: attempts >= LOCK_AFTER_ATTEMPTS
          ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
          : { failedLoginAttempts: attempts },
      });
    }
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  if (validCandidates.length > 1 && !parsed.data.workspace) {
    return NextResponse.json({
      error: "WORKSPACE_REQUIRED",
      message: "This email belongs to more than one workspace. Enter your company workspace code.",
    }, { status: 409 });
  }

  const user = validCandidates[0];
  const subscriptionActive = await requireActiveSubscription(user.companyId);
  if (!subscriptionActive) return NextResponse.json({ error: "SUBSCRIPTION_INACTIVE" }, { status: 403 });

  const token = await createMobileSessionToken({
    sub: user.id,
    kind: "tenant",
    role: user.role,
    name: user.name,
    email: user.email,
    tenantId: user.companyId,
  });

  await Promise.all([
    db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    }),
    db.auditLog.create({
      data: {
        companyId: user.companyId,
        actorId: user.id,
        actorEmail: user.email,
        action: "MOBILE_LOGIN",
        entityType: "User",
        entityId: user.id,
      },
    }),
  ]);

  return NextResponse.json({
    token,
    expiresInSeconds: 60 * 60 * 24 * 7,
    workspace: user.tenant.slug,
    employee: {
      id: user.employee!.id,
      name: user.employee!.fullName,
      arabicName: user.employee!.arabicName,
    },
  });
}
