"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  forgotPasswordAction,
  type ForgotPasswordState,
} from "@/app/(auth)/actions";
import { AlertCircle, CheckCircle, Mail } from "lucide-react";

export function ForgotPasswordClient() {
  const [state, formAction, pending] = useActionState<
    ForgotPasswordState,
    FormData
  >(forgotPasswordAction, { ok: true, message: "" });

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@company.com"
          required
          autoComplete="email"
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
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="w-full bg-brand-navy hover:bg-brand-navy/90"
        size="lg"
      >
        <Mail className="mr-2 h-4 w-4" />
        {pending ? "Sending..." : "Send Reset Link"}
      </Button>
    </form>
  );
}
