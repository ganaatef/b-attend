/** /change-password — forced password change page */
import { Metadata } from "next";
import { ChangePasswordClient } from "./ChangePasswordClient";

export const metadata: Metadata = {
  title: "Change Password",
};

export default function ChangePasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">Change Your Password</h1>
          <p className="text-sm text-muted-foreground">
            You must set a new password before continuing.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <ChangePasswordClient />
        </div>
      </div>
    </div>
  );
}
