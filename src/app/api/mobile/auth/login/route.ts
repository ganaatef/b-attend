import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createMobileSessionToken } from "@/lib/auth/session";
import { requireActiveSubscription } from "@/lib/auth/tenant";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(256),
});

export async function POST(request: NextRequest) {
  const parsed = LoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 400 });

  const user = await db.user.findFirst({
    where: {
      email: parsed.data.email.toLowerCase(),
      role: "EMPLOYEE",
      status: "ACTIVE",
      deletedAt: null,
      employeeId: { not: null },
    },
    include: { employee: true },
  });

  if (!user || !user.employee || user.employee.status !== "ACTIVE" || user.employee.deletedAt) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const [passwordValid, subscriptionActive] = await Promise.all([
    verifyPassword(parsed.data.password, user.passwordHash),
    requireActiveSubscription(user.companyId),
  ]);
  if (!passwordValid || !subscriptionActive) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const token = await createMobileSessionToken({
    sub: user.id,
    kind: "tenant",
    role: user.role,
    name: user.name,
    email: user.email,
    tenantId: user.companyId,
  });
  await Promise.all([
    db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
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
    employee: { id: user.employee.id, name: user.employee.fullName, arabicName: user.employee.arabicName },
  });
}
