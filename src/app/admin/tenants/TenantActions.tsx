"use client";

/**
 * Tenant action buttons — calls Server Actions via fetch.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  activateTrialAction,
  activateTenantAction,
  suspendTenantAction,
  reactivateTenantAction,
  cancelTenantAction,
  rejectTenantAction,
  impersonateTenantOwnerAction,
} from "@/app/admin/actions";
import { CheckCircle2, PauseCircle, PlayCircle, XCircle, UserCog, Hourglass } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TenantActions({ tenantId, status }: { tenantId: string; status: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setLoading(key);
    try {
      const r = await fn();
      if (!r.ok) alert(r.error ?? "Action failed");
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "PENDING_ACTIVATION" && (
        <>
          <Button size="sm" onClick={() => run("trial", () => activateTrialAction(tenantId))} disabled={loading === "trial"}>
            <Hourglass className="mr-1.5 h-3.5 w-3.5" /> Activate Trial
          </Button>
          <Button size="sm" onClick={() => run("activate", () => activateTenantAction(tenantId))} disabled={loading === "activate"}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Activate Paid
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={loading === "reject"}>
                <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reject this signup?</AlertDialogTitle>
                <AlertDialogDescription>The tenant will be marked as REJECTED. The owner will lose access.</AlertDialogDescription>
              </AlertDialogHeader>
              <div>
                <Label htmlFor="reject-reason">Reason</Label>
                <Input id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for rejection" />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => run("reject", () => rejectTenantAction(tenantId, reason || "No reason given"))}>Reject tenant</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {(status === "TRIAL_ACTIVE" || status === "PAST_DUE" || status === "GRACE_PERIOD") && (
        <Button size="sm" onClick={() => run("activate", () => activateTenantAction(tenantId))} disabled={loading === "activate"}>
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Activate Paid
        </Button>
      )}

      {(status === "ACTIVE" || status === "TRIAL_ACTIVE" || status === "PAST_DUE" || status === "GRACE_PERIOD") && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={loading === "suspend"}>
              <PauseCircle className="mr-1.5 h-3.5 w-3.5" /> Suspend
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Suspend this tenant?</AlertDialogTitle>
              <AlertDialogDescription>Owner can still access billing & support. Operational pages will be blocked.</AlertDialogDescription>
            </AlertDialogHeader>
            <div>
              <Label htmlFor="suspend-reason">Reason</Label>
              <Input id="suspend-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for suspension" />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => run("suspend", () => suspendTenantAction(tenantId, reason || "No reason given"))}>Suspend</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {status === "SUSPENDED" && (
        <Button size="sm" onClick={() => run("reactivate", () => reactivateTenantAction(tenantId))} disabled={loading === "reactivate"}>
          <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> Reactivate
        </Button>
      )}

      {status !== "CANCELLED" && status !== "REJECTED" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive" disabled={loading === "cancel"}>
              <XCircle className="mr-1.5 h-3.5 w-3.5" /> Cancel
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this tenant?</AlertDialogTitle>
              <AlertDialogDescription>This puts the tenant in read-only mode. This action cannot be easily undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <div>
              <Label htmlFor="cancel-reason">Reason</Label>
              <Input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for cancellation" />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep tenant</AlertDialogCancel>
              <AlertDialogAction onClick={() => run("cancel", () => cancelTenantAction(tenantId, reason || "No reason given"))}>Cancel tenant</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="secondary" disabled={loading === "impersonate"}>
            <UserCog className="mr-1.5 h-3.5 w-3.5" /> Impersonate Owner
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Impersonate the tenant owner?</AlertDialogTitle>
            <AlertDialogDescription>You will be logged in as the owner. Every action you take is recorded in the platform audit log with your identity. Provide a clear reason.</AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label htmlFor="impersonate-reason">Reason (required)</Label>
            <Input id="impersonate-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer cannot access billing page, debugging" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              setLoading("impersonate");
              const r = await impersonateTenantOwnerAction(tenantId, reason);
              if (!r?.ok) { alert(r?.error ?? "Impersonation failed"); setLoading(null); }
            }}>Start impersonation</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
