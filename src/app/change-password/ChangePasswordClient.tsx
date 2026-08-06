"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "@/app/(auth)/actions";
import { KeyRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

export function ChangePasswordClient() {
  const t = useTranslations("auth");
  const router = useRouter();

  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
    { ok: false },
  );

  useEffect(() => {
    if (state && state.ok) {
      toast.success(t("passwordChangedSuccess"));
      router.push("/login?reason=loggedout");
    } else if (state && !state.ok && state.error) {
      toast.error(state.error);
    }
  }, [state, router, t]);

  return (
    <form action={formAction} className="space-y-5">
      {state && !state.ok && state.error && state.error !== "New passwords do not match" ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div>
        <label htmlFor="currentPassword" className="block text-sm font-medium text-foreground mb-1.5">
          {t("currentPassword")}
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {state && !state.ok && state.fieldErrors?.currentPassword ? (
          <p className="mt-1 text-sm text-destructive">{state.fieldErrors.currentPassword}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-foreground mb-1.5">
          {t("newPassword")}
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          autoComplete="new-password"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {state && !state.ok && state.fieldErrors?.newPassword ? (
          <p className="mt-1 text-sm text-destructive">{state.fieldErrors.newPassword}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1.5">
          {t("confirmNewPassword")}
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {state && !state.ok && state.fieldErrors?.confirmPassword ? (
          <p className="mt-1 text-sm text-destructive">{state.fieldErrors.confirmPassword}</p>
        ) : null}
      </div>

      {state && !state.ok && state.error ? (
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
        <KeyRound className="mr-2 h-4 w-4" />
        {pending ? t("updating") : t("updatePassword")}
      </Button>
    </form>
  );
}
