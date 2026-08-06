import { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ResetPasswordClient } from "./ResetPasswordClient";

export const metadata: Metadata = {
  title: "Reset Password",
};

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; userId?: string }>;
}) {
  return (
    <ResetPasswordPageInner searchParams={searchParams} />
  );
}

async function ResetPasswordPageInner({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; userId?: string }>;
}) {
  const t = await getTranslations("auth");
  const { token, userId } = await searchParams;

  if (!token || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="space-y-4 text-center">
              <h1 className="text-xl font-bold text-foreground">
                {t("invalidResetLink")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("invalidResetLinkDesc")}
              </p>
              <Link
                href="/forgot-password"
                className="inline-block font-medium text-primary hover:underline"
              >
                {t("requestNewResetLink")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">{t("resetPassword")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("enterNewPassword")}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <ResetPasswordClient token={token} userId={userId} />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
