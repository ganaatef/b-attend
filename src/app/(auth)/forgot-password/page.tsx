import { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordClient } from "./ForgotPasswordClient";

export const metadata: Metadata = {
  title: "Forgot Password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">Forgot Password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email to receive a password reset link.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <ForgotPasswordClient />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Remember your password?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
