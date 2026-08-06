"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  resetPasswordAction,
  type ResetPasswordState,
} from "@/app/(auth)/actions";
import { AlertCircle, CheckCircle, Lock } from "lucide-react";

export function ResetPasswordClient({
  token,
  userId,
}: {
  token: string;
  userId: string;
}) {
  const [state, formAction, pending] = useActionState<
    ResetPasswordState,
    FormData
  >(resetPasswordAction, { ok: true, message: "" });

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="userId" value={userId} />

      <div className="space-y-2">
        <Label htmlFor="newPassword">New Password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="new-password"
        />
      </div>

      {state && !state.ok && state.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state && state.ok && state.message && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            {state.message}{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="w-full bg-brand-navy hover:bg-brand-navy/90"
        size="lg"
      >
        <Lock className="mr-2 h-4 w-4" />
        {pending ? "Resetting..." : "Reset Password"}
      </Button>
    </form>
  );
}
