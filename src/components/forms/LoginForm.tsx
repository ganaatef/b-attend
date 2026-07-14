// ===================================================================
// LoginForm — client form for /login.
// Uses loginAction server action.
// ===================================================================

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form, TextField } from "@/components/forms/fields";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { loginAction, type LoginState } from "@/app/(auth)/login/actions";
import { LogIn, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginForm() {
  const sp = useSearchParams();
  const reason = sp.get("reason");
  const next = sp.get("next");

  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    undefined,
  );

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (state && !state.ok) {
      if (state.fieldErrors) {
        for (const [k, v] of Object.entries(state.fieldErrors)) {
          form.setError(k as keyof LoginInput, { message: v });
        }
      }
      if (state.error && state.error !== "Please fix the highlighted fields.") {
        toast.error(state.error);
      }
    }
  }, [state, form]);

  const reasonBanner =
    reason === "unauthenticated"
      ? "Please sign in to continue."
      : reason === "loggedout"
        ? "You have been signed out."
        : reason === "forbidden"
          ? "You don't have permission to access that page."
          : null;

  return (
    <Form {...form}>
      <form action={formAction} className="space-y-5">
        {reasonBanner ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{reasonBanner}</AlertDescription>
          </Alert>
        ) : null}
        {next ? (
          <input type="hidden" name="next" value={next} />
        ) : null}

        <TextField
          control={form.control}
          name="email"
          label="Email"
          type="email"
          placeholder="you@company.com"
          required
          autoComplete="email"
        />
        <TextField
          control={form.control}
          name="password"
          label="Password"
          type="password"
          placeholder="Your password"
          required
          autoComplete="current-password"
        />

        {state && !state.ok && state.error && state.error !== "Please fix the highlighted fields." ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          type="submit"
          disabled={pending}
          className="w-full bg-brand-navy hover:bg-brand-navy/90"
          size="lg"
        >
          <LogIn className="mr-2 h-4 w-4" />
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Form>
  );
}
