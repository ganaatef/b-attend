import { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ForgotPasswordClient } from "./ForgotPasswordClient";

export const metadata: Metadata = {
  title: "Forgot Password",
};

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">{t("forgotPasswordTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("forgotPasswordSubtitle")}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <ForgotPasswordClient />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {t("rememberPassword")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
