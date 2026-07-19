/**
 * Locale helpers — get the active locale in server and client components.
 * Source of truth: the NEXT_LOCALE cookie (set by LanguageSwitcher).
 */
import { cookies } from "next/headers";
import { type Locale, defaultLocale, locales } from "@/i18n/config";

/**
 * Server-side: read the active locale from the NEXT_LOCALE cookie.
 * Use this in server components and server actions.
 */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }
  return defaultLocale;
}

/**
 * Server-side: convenience that returns "ar" | "en" string for passing
 * to getStatusLabel / displayXxx helpers.
 */
export async function getLocaleCode(): Promise<"ar" | "en"> {
  return (await getLocale()) as "ar" | "en";
}
