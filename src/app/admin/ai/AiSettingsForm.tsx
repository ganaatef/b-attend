"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { updateAiSettingsAction } from "./actions";
import type { SystemSetting } from "@prisma/client";
import { Loader2 } from "lucide-react";

export function AiSettingsForm({ settings }: { settings: SystemSetting }) {
  const [state, formAction] = useActionState(updateAiSettingsAction, { ok: false });
  const { pending } = useFormStatus();
  return (
    <form action={formAction} className="space-y-4">
      <div className="flex items-center gap-2">
        <Checkbox id="aiModuleEnabled" name="aiModuleEnabled" value="true" defaultChecked={settings.aiModuleEnabled} />
        <Label htmlFor="aiModuleEnabled" className="text-sm">AI module enabled globally</Label>
      </div>
      <div>
        <Label htmlFor="aiProvider">Default AI provider</Label>
        <Select name="aiProvider" defaultValue={settings.aiProvider}>
          <SelectTrigger id="aiProvider" className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MOCK">MOCK (templates, no API key)</SelectItem>
            <SelectItem value="OPENAI_PLACEHOLDER">OPENAI_PLACEHOLDER (requires OPENAI_API_KEY)</SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">If OPENAI_PLACEHOLDER is selected but no API key is set, the system falls back to MOCK.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <Checkbox id="aiDailyCoachEnabled" name="aiDailyCoachEnabled" value="true" defaultChecked={settings.aiDailyCoachEnabled} />
          <Label htmlFor="aiDailyCoachEnabled" className="text-sm">Daily coach enabled</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="aiEmployeeInsightsEnabled" name="aiEmployeeInsightsEnabled" value="true" defaultChecked={settings.aiEmployeeInsightsEnabled} />
          <Label htmlFor="aiEmployeeInsightsEnabled" className="text-sm">Employee insights enabled</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="aiManagerInsightsEnabled" name="aiManagerInsightsEnabled" value="true" defaultChecked={settings.aiManagerInsightsEnabled} />
          <Label htmlFor="aiManagerInsightsEnabled" className="text-sm">Manager insights enabled</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="allowOpenaiProvider" name="allowOpenaiProvider" value="true" defaultChecked={settings.allowOpenaiProvider} />
          <Label htmlFor="allowOpenaiProvider" className="text-sm">Allow OpenAI provider</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="mockProviderEnabled" name="mockProviderEnabled" value="true" defaultChecked={settings.mockProviderEnabled} />
          <Label htmlFor="mockProviderEnabled" className="text-sm">Mock provider enabled</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="aiPrivacyModeEnabled" name="aiPrivacyModeEnabled" value="true" defaultChecked={settings.aiPrivacyModeEnabled} />
          <Label htmlFor="aiPrivacyModeEnabled" className="text-sm">Privacy mode enabled</Label>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="maxAiGenerationsPerTenantPerMonth">Max AI generations per tenant per month</Label>
          <Input id="maxAiGenerationsPerTenantPerMonth" name="maxAiGenerationsPerTenantPerMonth" type="number" min={0} max={100000} defaultValue={settings.maxAiGenerationsPerTenantPerMonth} />
          <p className="mt-1 text-xs text-muted-foreground">Placeholder for rate limiting.</p>
        </div>
        <div>
          <Label htmlFor="aiDefaultLanguage">Default AI language</Label>
          <Select name="aiDefaultLanguage" defaultValue={settings.aiDefaultLanguage}>
            <SelectTrigger id="aiDefaultLanguage" className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EN">English</SelectItem>
              <SelectItem value="AR">Arabic</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.ok && <p className="text-xs text-brand-success">Settings saved.</p>}
      <Button type="submit" size="sm" disabled={pending}>{pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...</> : "Save AI settings"}</Button>
    </form>
  );
}
