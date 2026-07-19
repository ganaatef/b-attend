"use client";

/**
 * /clock — Mobile web clock with browser geolocation.
 */
import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { clockAction } from "./actions";
import type { Employee, Schedule, ShiftPolicy, Punch, Branch } from "@prisma/client";
import { Loader2, MapPin, LogIn, LogOut, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useTranslations, useLocale } from "next-intl";
import { employeeDisplayName } from "@/lib/employee-display";
import { displayPunchType } from "@/lib/locale-display";

type EmployeeWithRelations = Employee & { branch: Branch | null; defaultShiftPolicy: ShiftPolicy | null };

interface ClockPageProps {
  employee: EmployeeWithRelations | null;
  schedule: (Schedule & { shiftPolicy: ShiftPolicy | null }) | null;
  lastPunch: Punch | null;
}

export function ClockPage({ employee, schedule, lastPunch }: ClockPageProps) {
  const t = useTranslations("clock");
  const locale = useLocale();
  const [state, formAction] = useActionState(clockAction, { ok: false } as { ok: boolean; error?: string; punchId?: string; insideGeofence?: boolean; distanceMeters?: number; status?: string; type?: string });
  const [pending, setPending] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  if (!employee) {
    return (
      <Card><CardContent className="py-12">
        <p className="text-center text-sm text-muted-foreground">{t("noEmployeeDesc")}</p>
      </CardContent></Card>
    );
  }

  const nextAction = !lastPunch || lastPunch.type === "CLOCK_OUT" ? "CLOCK_IN" : "CLOCK_OUT";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGeoError(null);
    setPending(true);
    try {
      if (!("geolocation" in navigator)) {
        setGeoError(t("geolocationNotSupported"));
        setPending(false);
        return;
      }
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      });
      const formData = new FormData();
      formData.set("employeeId", employee!.id);
      formData.set("type", nextAction);
      formData.set("latitude", String(pos.coords.latitude));
      formData.set("longitude", String(pos.coords.longitude));
      formData.set("source", "MOBILE_WEB");
      const result = await clockAction({}, formData);
      if (!result.ok) setGeoError(result.error ?? t("clockFailed"));
      else window.location.reload();
    } catch (err: any) {
      if (err?.code === 1) setGeoError(t("locationPermissionDenied"));
      else if (err?.code === 2) setGeoError(t("locationUnavailable"));
      else if (err?.code === 3) setGeoError(t("locationTimeout"));
      else setGeoError(t("locationCaptureFailed", { message: err?.message ?? "" }));
    } finally {
      setPending(false);
    }
  }

  const branch = employee.branch;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{formatDateTime(new Date())}</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent/10 text-xl font-bold text-brand-accent">
              {employeeDisplayName(employee, locale).charAt(0).toUpperCase()}
            </div>
            <h2 className="text-base font-semibold text-foreground">{employeeDisplayName(employee, locale)}</h2>
            <p className="text-xs text-muted-foreground">{employee.employeeCode} · {employee.jobTitle ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{branch?.name ?? t("noBranchAssigned")}</p>
          </div>

          {schedule ? (
            <div className="mt-4 rounded-md border border-border bg-card/50 p-3 text-xs">
              <p className="font-medium text-foreground">{t("todayShift", { shift: schedule.shiftPolicy?.name ?? "—" })}</p>
              <p className="text-muted-foreground">
                {schedule.expectedStart ? new Date(schedule.expectedStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} → {schedule.expectedEnd ? new Date(schedule.expectedEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50/40 p-3 text-xs text-amber-800">
              {t("noScheduleWarning")}
            </div>
          )}

          {lastPunch && (
            <div className="mt-3 text-xs text-muted-foreground">
              {t("lastAction")}: <span className="font-medium text-foreground">{displayPunchType(lastPunch.type, locale)}</span> {locale === "ar" ? "الساعة" : "at"} {new Date(lastPunch.timestamp).toLocaleTimeString()}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="hidden" name="employeeId" value={employee.id} />
            <input type="hidden" name="type" value={nextAction} />
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("capturingLocation")}</> :
                nextAction === "CLOCK_IN" ? <><LogIn className="mr-2 h-4 w-4" /> {t("clockIn")}</> : <><LogOut className="mr-2 h-4 w-4" /> {t("clockOut")}</>}
            </Button>
          </form>
          {geoError && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{geoError}</span>
            </div>
          )}
          {state.ok && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-brand-success/30 bg-brand-success/5 p-2 text-xs text-brand-success">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {state.type === "CLOCK_IN" ? t("clockInSuccess") : t("clockOutSuccess")} successfully.
                {!state.insideGeofence && ` ${t("outsideGeofenceWarning")}`}
                {state.distanceMeters !== undefined && ` ${t("distanceFromBranch", { distance: String(state.distanceMeters) })}`}
              </span>
            </div>
          )}
          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" /> {t("locationCapturedOnly")}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
