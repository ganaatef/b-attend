"use client";

/**
 * /login — credentials form. Uses loginAction. Redirects based on role.
 */
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { loginAction, type LoginState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/Logo";
import { Loader2, LogIn } from "lucide-react";

const initialState: LoginState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...
        </>
      ) : (
        <>
          <LogIn className="mr-2 h-4 w-4" /> Sign in
        </>
      )}
    </Button>
  );
}

function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, initialState);
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  useEffect(() => {
    if (state.ok) {
      router.push(next && next.startsWith("/") ? next : "/admin");
    }
  }, [state, router, next]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="super@b-attend.app" />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
      </div>
      {!state.ok && state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <SubmitButton />
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo className="h-10 w-10" />
            <h1 className="mt-3 text-xl font-bold tracking-tight text-foreground">B-Attend</h1>
            <p className="mt-1 text-xs text-muted-foreground">Sign in to your account</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
              <LoginForm />
            </Suspense>
          </div>
          <div className="mt-4 rounded-md border border-dashed border-border bg-card/40 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Demo accounts (password: demo1234)</p>
            <ul className="mt-1.5 space-y-0.5">
              <li>super@b-attend.app — Super Admin</li>
              <li>sales@b-attend.app — Sales Admin</li>
              <li>support@b-attend.app — Support Agent</li>
              <li>billing@b-attend.app — Billing Admin</li>
            </ul>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-brand-accent hover:underline">
              Get started
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
