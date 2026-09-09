"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acceptInviteAction, type AcceptInviteState } from "@/app/(auth)/invite-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";

export function AcceptInviteClient({ token, isArabic }: { token: string; isArabic: boolean }) {
  const [state, formAction, pending] = useActionState<AcceptInviteState, FormData>(acceptInviteAction, { ok: false });

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-2">
        <Label htmlFor="password">{isArabic ? "كلمة المرور الجديدة" : "New password"}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={12}
          maxLength={128}
          required
          autoComplete="new-password"
          placeholder="••••••••••••"
        />
        <p className="text-xs text-muted-foreground">
          {isArabic ? "12 حرفًا على الأقل، وتحتوي على حرف ورقم" : "At least 12 characters, including a letter and a number"}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{isArabic ? "تأكيد كلمة المرور" : "Confirm password"}</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          minLength={12}
          maxLength={128}
          required
          autoComplete="new-password"
          placeholder="••••••••••••"
        />
      </div>

      {!state.ok && state.error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {state.ok ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p>{isArabic ? "تم إنشاء حسابك بنجاح" : state.message}</p>
            <Link href="/login" className="inline-block font-semibold text-primary hover:underline">
              {isArabic ? "تسجيل الدخول" : "Sign in"}
            </Link>
          </AlertDescription>
        </Alert>
      ) : (
        <Button type="submit" disabled={pending} className="w-full" size="lg">
          <KeyRound className="me-2 h-4 w-4" />
          {pending
            ? (isArabic ? "جاري تفعيل الحساب..." : "Activating account...")
            : (isArabic ? "تفعيل حسابي" : "Activate my account")}
        </Button>
      )}
    </form>
  );
}
