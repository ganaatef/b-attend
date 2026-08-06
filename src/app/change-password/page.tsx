/** /change-password — forced password change page */
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChangePasswordClient } from "./ChangePasswordClient";

export const metadata: Metadata = {
  title: "Change Password",
};

export default async function ChangePasswordPage() {
  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">{t("changePasswordTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("changePasswordSubtitle")}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <ChangePasswordClient />
        </div>
      </div>
    </div>
  );
}
