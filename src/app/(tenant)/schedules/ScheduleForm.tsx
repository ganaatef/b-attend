"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createScheduleAction } from "../actions";
import type { Branch, Employee, ShiftPolicy } from "@prisma/client";
import { Loader2, Moon, Sun } from "lucide-react";

export function ScheduleForm({ branches, employees, policies }: { branches: Branch[]; employees: Employee[]; policies: ShiftPolicy[] }) {
  const [state, formAction] = useActionState(createScheduleAction, { ok: false });
  const { pending } = useFormStatus();
  const t = useTranslations("schedules");

  const [policyId, setPolicyId] = useState("");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [useCustomTimes, setUseCustomTimes] = useState(false);

  const selectedPolicy = policies.find((p) => p.id === policyId);

  function handlePolicyChange(val: string) {
    setPolicyId(val);
    const p = policies.find((pp) => pp.id === val);
    if (p && !useCustomTimes) {
      setPlannedStart(p.startTime);
      setPlannedEnd(p.endTime);
    }
  }

  function toggleCustomTimes() {
    if (useCustomTimes) {
      setUseCustomTimes(false);
      if (selectedPolicy) {
        setPlannedStart(selectedPolicy.startTime);
        setPlannedEnd(selectedPolicy.endTime);
      }
    } else {
      setUseCustomTimes(true);
    }
  }

  const isOvernight = plannedStart && plannedEnd && plannedStart > plannedEnd;
  const duration = plannedStart && plannedEnd ? (() => {
    const [sh, sm] = plannedStart.split(":").map(Number);
    const [eh, em] = plannedEnd.split(":").map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) mins += 24 * 60;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  })() : null;

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-5">
      <div className="sm:col-span-2">
        <Label htmlFor="employeeId">{t("employeeRequired")}</Label>
        <Select name="employeeId" required><SelectTrigger id="employeeId"><SelectValue placeholder={t("selectPlaceholder")} /></SelectTrigger><SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.fullName} ({e.employeeCode})</SelectItem>)}</SelectContent></Select>
      </div>
      <div>
        <Label htmlFor="branchId">{t("branchRequired")}</Label>
        <Select name="branchId" required><SelectTrigger id="branchId"><SelectValue placeholder={t("selectPlaceholder")} /></SelectTrigger><SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
      </div>
      <div>
        <Label htmlFor="date">{t("dateRequired")}</Label>
        <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
      </div>
      <div>
        <Label htmlFor="shiftPolicyId">{t("policyRequired")}</Label>
        <Select name="shiftPolicyId" required value={policyId} onValueChange={handlePolicyChange}>
          <SelectTrigger id="shiftPolicyId"><SelectValue placeholder={t("selectPlaceholder")} /></SelectTrigger>
          <SelectContent>{policies.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="sm:col-span-5 flex items-center gap-3 border-t border-border pt-3">
        <Button type="button" variant={useCustomTimes ? "default" : "outline"} size="sm" onClick={toggleCustomTimes} className="text-xs">
          {useCustomTimes ? <><Sun className="mr-1 h-3 w-3" /> {t("customTimes")}</> : <><Moon className="mr-1 h-3 w-3" /> {t("usePolicyTimes")}</>}
        </Button>
        {duration && <span className="text-xs text-muted-foreground">{t("durationLabel")} {duration}</span>}
        {isOvernight && <span className="text-xs text-amber-600">{t("overnightShift")}</span>}
      </div>
      {useCustomTimes && (
        <div className="sm:col-span-5 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="plannedStart">{t("plannedStart")}</Label>
            <Input id="plannedStart" name="plannedStart" type="time" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="plannedEnd">{t("plannedEnd")}</Label>
            <Input id="plannedEnd" name="plannedEnd" type="time" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} />
          </div>
        </div>
      )}
      {!useCustomTimes && selectedPolicy && (
        <input type="hidden" name="plannedStart" value={selectedPolicy.startTime} />
      )}
      {!useCustomTimes && selectedPolicy && (
        <input type="hidden" name="plannedEnd" value={selectedPolicy.endTime} />
      )}
      <div className="sm:col-span-5 flex items-center gap-3">
        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
        {state.ok && <p className="text-xs text-brand-success">{t("scheduleAdded")}</p>}
        <Button type="submit" size="sm" disabled={pending} className="ml-auto">{pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> {t("saving")}</> : t("addScheduleBtn")}</Button>
      </div>
    </form>
  );
}
