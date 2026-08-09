"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { localeNames, type Locale, locales } from "@/i18n/config";

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function switchTo(next: Locale) {
    setOpen(false);
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch language"
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>{localeNames[locale]}</span>
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1 min-w-[130px] rounded-md border border-border bg-card shadow-md"
        >
          {locales.map((l) => (
            <button
              key={l}
              type="button"
              role="option"
              aria-selected={l === locale}
              onClick={() => switchTo(l)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors first:rounded-t-md last:rounded-b-md hover:bg-muted ${
                l === locale ? "text-primary bg-muted/50" : "text-foreground"
              }`}
            >
              {l === locale && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              {localeNames[l]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
