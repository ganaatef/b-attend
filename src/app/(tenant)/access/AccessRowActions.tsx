"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { revokeInvitationAction, restoreUserAction, suspendUserAction } from "./actions";

export function UserStatusAction({ userId, suspended, isArabic }: { userId: string; suspended: boolean; isArabic: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-end">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(async () => {
          setError(null);
          const result = suspended ? await restoreUserAction(userId) : await suspendUserAction(userId);
          if (!result.ok) setError(result.error || "Action failed");
          else router.refresh();
        })}
      >
        {pending
          ? (isArabic ? "جاري التنفيذ..." : "Working...")
          : suspended
            ? (isArabic ? "إعادة التفعيل" : "Restore")
            : (isArabic ? "إيقاف الدخول" : "Suspend")}
      </Button>
      {error ? <p className="mt-1 max-w-48 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function RevokeInvitationAction({ invitationId, isArabic }: { invitationId: string; isArabic: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="text-end">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(async () => {
          setError(null);
          const result = await revokeInvitationAction(invitationId);
          if (!result.ok) setError(result.error || "Action failed");
          else router.refresh();
        })}
      >
        {pending ? (isArabic ? "جاري الإلغاء..." : "Revoking...") : (isArabic ? "إلغاء الدعوة" : "Revoke")}
      </Button>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
