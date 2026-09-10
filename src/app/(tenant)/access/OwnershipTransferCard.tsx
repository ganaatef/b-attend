"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, KeyRound } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { transferOwnershipAction, type OwnershipTransferState } from "./ownership-actions";

type Candidate = {
  id: string;
  name: string;
  email: string;
};

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus:ring-2 focus:ring-ring";

export function OwnershipTransferCard({
  candidates,
  isArabic,
}: {
  candidates: Candidate[];
  isArabic: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<OwnershipTransferState, FormData>(transferOwnershipAction, { ok: false });

  useEffect(() => {
    if (!state.ok || !state.signedOut) return;
    router.replace("/login?reason=ownership-transferred");
    router.refresh();
  }, [router, state.ok, state.signedOut]);

  return (
    <section className="rounded-xl border border-destructive/30 bg-card shadow-sm">
      <div className="border-b border-destructive/20 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-destructive/10 p-2 text-destructive">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">
              {isArabic ? "نقل ملكية الشركة" : "Transfer company ownership"}
            </h2>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
              {isArabic
                ? "إجراء أمني حساس: المالك الجديد يحصل على صلاحيات المالك الأساسية، ويتم تحويل حسابك إلى مدير موارد بشرية ثم تسجيل خروجك فورًا"
                : "Security-sensitive action: the selected user becomes the primary owner, your account is demoted to HR Admin, and your current session is signed out immediately."}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {candidates.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {isArabic
                ? "لا يوجد مستخدم نشط آخر يمكن نقل الملكية إليه. أرسل دعوة لمستخدم موثوق وفعّل حسابه أولًا"
                : "There is no other active user eligible to become owner. Invite and activate a trusted user first."}
            </AlertDescription>
          </Alert>
        ) : (
          <form action={action} className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {isArabic
                  ? "راجع البريد والاسم بعناية. لا يمكن تنفيذ النقل إلا من حساب المالك الحالي وبعد إعادة إدخال كلمة المرور وكتابة TRANSFER حرفيًا"
                  : "Verify the recipient carefully. Transfer is allowed only from the current owner after password re-authentication and typing TRANSFER exactly."}
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="ownership-target">{isArabic ? "المالك الجديد" : "New primary owner"}</Label>
                <select id="ownership-target" name="targetUserId" className={selectClass} required defaultValue="">
                  <option value="" disabled>{isArabic ? "اختر مستخدمًا نشطًا" : "Select an active user"}</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} — {candidate.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ownership-phone">{isArabic ? "هاتف المالك الجديد" : "New owner phone"}</Label>
                <Input id="ownership-phone" name="newOwnerPhone" type="tel" required minLength={6} maxLength={30} autoComplete="tel" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ownership-password">{isArabic ? "كلمة مرورك الحالية" : "Your current password"}</Label>
                <Input id="ownership-password" name="currentPassword" type="password" required autoComplete="current-password" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownership-confirmation">
                {isArabic ? "اكتب TRANSFER للتأكيد" : "Type TRANSFER to confirm"}
              </Label>
              <Input
                id="ownership-confirmation"
                name="confirmation"
                required
                autoComplete="off"
                spellCheck={false}
                pattern="TRANSFER"
                placeholder="TRANSFER"
              />
            </div>

            {state.error ? (
              <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>
            ) : null}

            <Button type="submit" variant="destructive" disabled={pending}>
              {pending
                ? (isArabic ? "جاري التحقق والنقل..." : "Verifying and transferring...")
                : (isArabic ? "نقل الملكية نهائيًا" : "Transfer ownership")}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
