"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  requestEmployeeBiometricEnrollmentAction,
  revokeEmployeeBiometricEnrollmentAction,
} from "../../biometric-actions";

type Props = {
  employeeId: string;
  status: "NONE" | "PENDING" | "ACTIVE" | "REVOKED" | "REENROLL_REQUIRED";
  hasActiveUser: boolean;
  providerAvailable: boolean;
};

export function BiometricEnrollmentControls({ employeeId, status, hasActiveUser, providerAvailable }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("Security administrator revocation");

  const requestEnrollment = () => {
    const form = new FormData();
    form.set("employeeId", employeeId);
    startTransition(async () => {
      const result = await requestEmployeeBiometricEnrollmentAction(form);
      setMessage(result.ok ? "Enrollment request created. The employee can now consent and enroll from the staff app." : result.error ?? "Enrollment request failed");
    });
  };

  const revoke = () => {
    const form = new FormData();
    form.set("employeeId", employeeId);
    form.set("reason", reason);
    startTransition(async () => {
      const result = await revokeEmployeeBiometricEnrollmentAction(form);
      setMessage(result.ok ? "Biometric identity revoked." : result.error ?? "Revocation failed");
    });
  };

  return (
    <div className="space-y-3">
      {!providerAvailable && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          A production biometric provider is not configured. Enrollment stays disabled until AWS Rekognition is configured server-side.
        </p>
      )}
      {!hasActiveUser && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          This employee needs an active linked staff account before biometric enrollment.
        </p>
      )}

      {(status === "NONE" || status === "REVOKED" || status === "REENROLL_REQUIRED") && (
        <Button disabled={pending || !hasActiveUser || !providerAvailable} onClick={requestEnrollment}>
          {pending ? "Working…" : status === "NONE" ? "Request biometric enrollment" : "Request re-enrollment"}
        </Button>
      )}

      {status === "PENDING" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Waiting for the employee to consent and complete a live capture in the staff app.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={pending || !hasActiveUser || !providerAvailable} onClick={requestEnrollment}>
              Restart enrollment request
            </Button>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} className="max-w-sm" />
            <Button variant="destructive" disabled={pending || reason.trim().length < 3} onClick={revoke}>Cancel & revoke</Button>
          </div>
        </div>
      )}

      {status === "ACTIVE" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} className="max-w-sm" />
          <Button variant="destructive" disabled={pending || reason.trim().length < 3} onClick={revoke}>
            {pending ? "Revoking…" : "Revoke biometric identity"}
          </Button>
        </div>
      )}

      {message && <p className="text-sm text-muted-foreground" role="status">{message}</p>}
    </div>
  );
}
