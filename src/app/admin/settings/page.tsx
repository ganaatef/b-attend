/** /admin/settings */
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "./SettingsForm";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const t = await getTranslations("adminSettings");
  const [settings, plans] = await Promise.all([
    db.systemSetting.findFirst({ where: { isMain: true }, include: { defaultPlan: true } }),
    db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!settings) return <div className="p-4 text-sm text-muted-foreground">System settings not initialized. Run `bun prisma/seed.ts`.</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold text-foreground">{t("general")}</CardTitle></CardHeader>
        <CardContent><SettingsForm settings={settings} plans={plans} /></CardContent>
      </Card>
    </div>
  );
}
