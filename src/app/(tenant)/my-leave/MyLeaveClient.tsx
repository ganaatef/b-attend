"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createEmployeeLeaveRequestAction, cancelEmployeeLeaveRequestAction, type LeaveFormState } from "../hr/actions";
import { Loader2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

type LeaveType = { id: string; name: string; code: string };
type LeaveRequest = {
  id: string;
  leaveTypeId: string;
  startDate: Date;
  endDate: Date;
  daysCount: number;
  reason: string | null;
  status: string;
  leaveType: { name: string; code: string };
};

function LeaveForm({ leaveTypes }: { leaveTypes: LeaveType[] }) {
  const [state, formAction] = useActionState<LeaveFormState, FormData>(createEmployeeLeaveRequestAction, { ok: false, error: "", id: "" });
  const { pending } = useFormStatus();
  const t = useTranslations("myLeave");

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="leaveTypeId">{t("leaveTypeLabel")}</Label>
        <Select name="leaveTypeId">
          <SelectTrigger id="leaveTypeId"><SelectValue placeholder={t("selectLeaveType")} /></SelectTrigger>
          <SelectContent>
            {leaveTypes.map((lt) => (
              <SelectItem key={lt.id} value={lt.id}>{lt.name} ({lt.code})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="startDate">{t("startDateLabel")}</Label>
          <Input id="startDate" name="startDate" type="date" required />
        </div>
        <div>
          <Label htmlFor="endDate">{t("endDateLabel")}</Label>
          <Input id="endDate" name="endDate" type="date" required />
        </div>
      </div>
      <div>
        <Label htmlFor="reason">{t("reasonLabel")}</Label>
        <Textarea id="reason" name="reason" rows={3} placeholder={t("reasonPlaceholder")} />
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.ok && <p className="text-xs text-brand-success">{t("submittedSuccess")}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> {t("submittingLabel")}</> : t("submitBtn")}
      </Button>
    </form>
  );
}

function CancelButton({ requestId }: { requestId: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleCancel() {
    setPending(true);
    await cancelEmployeeLeaveRequestAction(requestId);
    setPending(false);
    router.refresh();
  }

  return (
    <button onClick={handleCancel} disabled={pending} className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-[10px] font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50">
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />} Cancel
    </button>
  );
}

export function MyLeaveClient({
  leaveTypes,
  leaveRequests,
  requestStatusColor,
}: {
  leaveTypes: LeaveType[];
  leaveRequests: LeaveRequest[];
  requestStatusColor: (status: string) => string;
}) {
  const pendingRequests = leaveRequests.filter((lr) => lr.status === "PENDING");
  const t = useTranslations("myLeave");

  return (
    <>
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">{t("newLeaveRequest")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LeaveForm leaveTypes={leaveTypes} />
        </CardContent>
      </Card>

      {pendingRequests.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">{t("pendingRequests")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/60">
              {pendingRequests.map((lr) => (
                <div key={lr.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">{lr.leaveType.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(lr.startDate).toLocaleDateString()} — {new Date(lr.endDate).toLocaleDateString()} · {lr.daysCount} {lr.daysCount === 1 ? t("day") : t("daysPlural")}
                    </p>
                    {lr.reason && <p className="text-[10px] text-muted-foreground truncate max-w-[300px]">{lr.reason}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${requestStatusColor(lr.status)}`}>{t("pendingStatus")}</span>
                    <CancelButton requestId={lr.id} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
