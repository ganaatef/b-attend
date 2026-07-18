"use client";

/**
 * Tenant action buttons — calls Server Actions via fetch.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("adminTenants");
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
            <Hourglass className="mr-1.5 h-3.5 w-3.5" /> {t("activateTrial")}
          </Button>
          <Button size="sm" onClick={() => run("activate", () => activateTenantAction(tenantId))} disabled={loading === "activate"}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> {t("activatePaid")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={loading === "reject"}>
                <XCircle className="mr-1.5 h-3.5 w-3.5" /> {t("reject")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("rejectConfirm")}</AlertDialogTitle>
                <AlertDialogDescription>The tenant will be marked as REJECTED. The owner will lose access.</AlertDialogDescription>
              </AlertDialogHeader>
              <div>
                <Label htmlFor="reject-reason">Reason</Label>
                <Input id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonRequired")} />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => run("reject", () => rejectTenantAction(tenantId, reason || "No reason given"))}>{t("confirmAction")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {(status === "TRIAL_ACTIVE" || status === "PAST_DUE" || status === "GRACE_PERIOD") && (
        <Button size="sm" onClick={() => run("activate", () => activateTenantAction(tenantId))} disabled={loading === "activate"}>
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> {t("activatePaid")}
        </Button>
      )}

      {(status === "ACTIVE" || status === "TRIAL_ACTIVE" || status === "PAST_DUE" || status === "GRACE_PERIOD") && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={loading === "suspend"}>
              <PauseCircle className="mr-1.5 h-3.5 w-3.5" /> {t("suspend")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("suspendConfirm")}</AlertDialogTitle>
              <AlertDialogDescription>Owner can still access billing & support. Operational pages will be blocked.</AlertDialogDescription>
            </AlertDialogHeader>
            <div>
              <Label htmlFor="suspend-reason">Reason</Label>
              <Input id="suspend-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonRequired")} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => run("suspend", () => suspendTenantAction(tenantId, reason || "No reason given"))}>{t("confirmAction")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {status === "SUSPENDED" && (
        <Button size="sm" onClick={() => run("reactivate", () => reactivateTenantAction(tenantId))} disabled={loading === "reactivate"}>
          <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> {t("reactivate")}
        </Button>
      )}

      {status !== "CANCELLED" && status !== "REJECTED" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive" disabled={loading === "cancel"}>
              <XCircle className="mr-1.5 h-3.5 w-3.5" /> {t("cancel")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("cancelConfirm")}</AlertDialogTitle>
              <AlertDialogDescription>This puts the tenant in read-only mode. This action cannot be easily undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <div>
              <Label htmlFor="cancel-reason">Reason</Label>
              <Input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonRequired")} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => run("cancel", () => cancelTenantAction(tenantId, reason || "No reason given"))}>{t("confirmAction")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="secondary" disabled={loading === "impersonate"}>
            <UserCog className="mr-1.5 h-3.5 w-3.5" /> {t("impersonate")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("impersonate")}</AlertDialogTitle>
            <AlertDialogDescription>You will be logged in as the owner. Every action you take is recorded in the platform audit log with your identity. Provide a clear reason.</AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label htmlFor="impersonate-reason">Reason (required)</Label>
            <Input id="impersonate-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonRequired")} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              setLoading("impersonate");
              const r = await impersonateTenantOwnerAction(tenantId, reason);
              if (!r?.ok) { alert(r?.error ?? "Impersonation failed"); setLoading(null); }
            }}>{t("confirmAction")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
