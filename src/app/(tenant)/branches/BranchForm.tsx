"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBranchAction } from "../actions";
import { Loader2 } from "lucide-react";

export function BranchForm() {
  const t = useTranslations("branches");
  const [state, formAction] = useActionState(createBranchAction, { ok: false });
  const { pending } = useFormStatus();
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      <div><Label htmlFor="name">{t("nameLabel")}</Label><Input id="name" name="name" required placeholder="New Cairo" /></div>
      <div><Label htmlFor="code">{t("codeLabel")}</Label><Input id="code" name="code" required placeholder="NC" /></div>
      <div><Label htmlFor="city">{t("cityLabel")}</Label><Input id="city" name="city" placeholder="Cairo" /></div>
      <div className="sm:col-span-2"><Label htmlFor="address">{t("addressLabel")}</Label><Input id="address" name="address" placeholder="5th Settlement" /></div>
      <div><Label htmlFor="geofenceRadius">{t("geofenceRadiusLabel")}</Label><Input id="geofenceRadius" name="geofenceRadius" type="number" min={50} max={2000} defaultValue={150} /></div>
      <div><Label htmlFor="latitude">{t("latitudeLabel")}</Label><Input id="latitude" name="latitude" type="number" step="any" placeholder="30.0254" /></div>
      <div><Label htmlFor="longitude">{t("longitudeLabel")}</Label><Input id="longitude" name="longitude" type="number" step="any" placeholder="31.4913" /></div>
      <div><Label htmlFor="area">{t("areaLabel")}</Label><Input id="area" name="area" placeholder="New Cairo" /></div>
      <div className="sm:col-span-3 flex items-center gap-3">
        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
        {state.ok && <p className="text-xs text-brand-success">{t("branchAdded")}</p>}
        <Button type="submit" size="sm" disabled={pending} className="ml-auto">
          {pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> {t("saving")}</> : t("addBranchBtn")}
        </Button>
      </div>
    </form>
  );
}
