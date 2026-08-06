"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Form, TextField } from "@/components/forms/fields";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { loginAction, type LoginState } from "@/app/(auth)/actions";
import { LogIn, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

export function LoginForm() {
  const sp = useSearchParams();
  const reason = sp.get("reason");
  const next = sp.get("next");
  const t = useTranslations("auth");

  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    { ok: false },
  );

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema) as any,
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (state && state.ok && state.forcePasswordChange) {
      window.location.href = "/change-password";
    }
  }, [state]);

  useEffect(() => {
    if (state && !state.ok) {
      if (state.error && state.error !== "Please fix the highlighted fields.") {
        toast.error(state.error);
      }
    }
  }, [state, form]);

  const reasonBanner =
    reason === "unauthenticated"
      ? t("pleaseSignIn")
      : reason === "loggedout"
        ? t("signedOut")
        : reason === "forbidden"
          ? t("noPermission")
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
          label={t("email")}
          type="email"
          placeholder="you@company.com"
          required
          autoComplete="email"
        />
        <TextField
          control={form.control}
          name="password"
          label={t("password")}
          type="password"
          placeholder="••••••••"
          required
          autoComplete="current-password"
        />

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-primary hover:underline"
          >
            Forgot Password?
          </Link>
        </div>

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
          {pending ? t("signingIn") : t("signInButton")}
        </Button>
      </form>
    </Form>
  );
}
