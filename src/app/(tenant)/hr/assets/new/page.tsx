"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAssetAction } from "../../actions";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export default function NewAssetPage() {
  const t = useTranslations("hrAssets");
  const router = useRouter();
  const [state, formAction] = useActionState(createAssetAction, { ok: false, error: "" });

  if (state.ok) {
    router.push("/hr/assets");
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/assets" className="text-xs text-muted-foreground hover:text-foreground">← Assets</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">{t("addAsset")}</h1>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-foreground">Asset Details</CardTitle></CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            {state.error && <p className="text-xs text-destructive">{state.error}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required placeholder="e.g. Chef Uniform" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type">Type *</Label>
                <select id="type" name="type" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" required>
                  <option value="UNIFORM">Uniform</option>
                  <option value="DEVICE">Device</option>
                  <option value="CARD">Card</option>
                  <option value="KEY">Key</option>
                  <option value="TOOLS">Tools</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" placeholder="e.g. AST-001" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <textarea id="notes" name="notes" rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" placeholder="Optional notes" />
            </div>

            <div className="flex justify-end gap-2">
              <Link href="/hr/assets"><Button type="button" variant="outline" size="sm">Cancel</Button></Link>
              <SubmitButton />
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function SubmitButton() {
  const t = useTranslations("hrAssets");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> {t("adding")}</> : t("addAsset")}
    </Button>
  );
}
