import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { ShieldCheck, Users } from "lucide-react";
import { db } from "@/lib/db";
import { hashInvitationToken } from "@/lib/auth/invitation-token";
import { AcceptInviteClient } from "./AcceptInviteClient";

export const metadata: Metadata = { title: "Accept invitation | B-Attend" };
export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const locale = await getLocale();
  const isArabic = locale === "ar";
  const { token } = await searchParams;

  const invitation = token
    ? await db.userInvitation.findUnique({
        where: { tokenHash: hashInvitationToken(token) },
        select: {
          name: true,
          email: true,
          status: true,
          expiresAt: true,
          revokedAt: true,
          tenant: { select: { name: true, nameAr: true, deletedAt: true } },
          roles: { include: { role: { select: { name: true } } } },
        },
      })
    : null;

  const valid = Boolean(
    invitation &&
    invitation.status === "PENDING" &&
    !invitation.revokedAt &&
    invitation.expiresAt > new Date() &&
    !invitation.tenant.deletedAt,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10" dir={isArabic ? "rtl" : "ltr"}>
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">B-Attend</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isArabic ? "دعوة آمنة للانضمام إلى مساحة العمل" : "Secure workspace invitation"}
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {!valid || !invitation || !token ? (
            <div className="space-y-4 text-center">
              <h2 className="text-lg font-semibold text-foreground">
                {isArabic ? "رابط الدعوة غير صالح" : "Invitation unavailable"}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {isArabic
                  ? "الرابط قد يكون منتهي الصلاحية أو تم استخدامه أو إلغاؤه. اطلب من مسؤول شركتك إرسال دعوة جديدة."
                  : "This link may have expired, already been used, or been revoked. Ask your company administrator to send a new invitation."}
              </p>
              <Link href="/login" className="font-semibold text-primary hover:underline">
                {isArabic ? "العودة لتسجيل الدخول" : "Back to sign in"}
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-xl bg-muted/50 p-4">
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 h-5 w-5 text-primary" />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {isArabic ? (invitation.tenant.nameAr || invitation.tenant.name) : invitation.tenant.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{invitation.name} · {invitation.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isArabic ? "الدور: " : "Role: "}
                      {invitation.roles.map((item) => item.role.name).join(", ")}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {isArabic ? "أنشئ كلمة المرور لتفعيل حسابك" : "Create your password to activate your account"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isArabic
                    ? "لن نرسل لك كلمة مرور مؤقتة. أنت فقط من يحدد كلمة المرور من خلال هذه الدعوة المشفرة."
                    : "We never send temporary passwords. Only you set your password through this secure invitation."}
                </p>
              </div>

              <AcceptInviteClient token={token} isArabic={isArabic} />
            </div>
          )}
        </section>

        <p className="text-center text-xs text-muted-foreground">
          {isArabic ? "إذا لم تتوقع هذه الدعوة، تجاهل الرابط ولا تشاركه مع أي شخص" : "If you did not expect this invitation, ignore it and do not share this link."}
        </p>
      </div>
    </main>
  );
}
