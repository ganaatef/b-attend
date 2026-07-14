"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
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
          <SelectTrigger id="aiProvider" className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MOCK">MOCK (templates, no API key)</SelectItem>
            <SelectItem value="OPENAI">OPENAI (placeholder, requires OPENAI_API_KEY)</SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">If OPENAI is selected but no API key is set, the system falls back to MOCK.</p>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="aiDailyCoachEnabled" name="aiDailyCoachEnabled" value="true" defaultChecked={settings.aiDailyCoachEnabled} />
        <Label htmlFor="aiDailyCoachEnabled" className="text-sm">Daily coach enabled</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="aiEmployeeInsightsEnabled" name="aiEmployeeInsightsEnabled" value="true" defaultChecked={settings.aiEmployeeInsightsEnabled} />
        <Label htmlFor="aiEmployeeInsightsEnabled" className="text-sm">Employee insights enabled</Label>
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.ok && <p className="text-xs text-brand-success">Settings saved.</p>}
      <Button type="submit" size="sm" disabled={pending}>{pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving...</> : "Save AI settings"}</Button>
    </form>
  );
}
