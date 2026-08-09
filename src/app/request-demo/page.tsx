import { getTranslations } from "next-intl/server";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { DemoForm } from "./DemoForm";

export default async function RequestDemoPage() {
  const t = await getTranslations("demo");
  return (
    <PublicLayout>
      <section className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            {t("subtitle")}
          </p>
        </div>
      </section>
      <section className="bg-background">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <DemoForm />
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
