"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { localeNames, type Locale, locales } from "@/i18n/config";

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();

  return (
    <div className="relative group">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        aria-label="Switch language"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{localeNames[locale]}</span>
      </button>
      <div className="absolute right-0 top-full z-50 mt-1 hidden min-w-[120px] rounded-md border border-border bg-card shadow-md group-hover:block">
        {locales.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => {
              document.cookie = `NEXT_LOCALE=${l};path=/;max-age=31536000`;
              router.refresh();
            }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted ${
              l === locale ? "text-primary bg-muted/50" : "text-foreground"
            }`}
          >
            {l === locale && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            {localeNames[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
