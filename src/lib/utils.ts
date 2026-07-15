// ===================================================================
// Utility helpers used across the B-Attend codebase.
// ===================================================================

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Slugify a string for use in a URL-safe identifier (tenant slug).
 * Lowercases, replaces non-alphanumeric with hyphens, trims.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Ensure a slug is non-empty after slugifying; falls back to a random suffix.
 */
export function safeSlug(input: string, fallbackSeed = "tenant"): string {
  const s = slugify(input);
  if (s.length >= 3) return s;
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${fallbackSeed}-${rnd}`;
}

/** Format an integer amount of currency (in whole units) as a readable string. */
export function formatCurrency(
  amount: number,
  currency = "EGP",
  locale = "en-US",
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/**
 * Format a number using Western (Latin) digits (en-US) regardless of the
 * viewer's browser locale. This prevents Eastern Arabic numerals (٠-٩) from
 * appearing when a browser is set to Arabic.
 */
export function formatNumber(value: number, locale = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Format a Date as a locale-independent string using Western digits (en-US).
 * Prevents Arabic-numeral dates when the viewer's browser is set to Arabic.
 */
export function formatDateTime(value: Date | string | number, locale = "en-US"): string {
  try {
    const d = value instanceof Date ? value : new Date(value);
    return d.toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

/** Returns the number of days between two dates (rounded down, absolute). */
export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Title-case a status enum value: TRIAL_ACTIVE → Trial Active */
export function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Generate a short, mostly-unique reference (e.g. INV-XXXXXX). */
export function shortReference(prefix = ""): string {
  const rnd = Math.random().toString(36).toUpperCase().slice(2, 8);
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  return `${prefix}${prefix ? "-" : ""}${ts}${rnd}`;
}

/**
 * Strip a string to a safe single-line printable representation, useful
 * for logging IDs/emails without leaking PII noise (does NOT redact).
 */
export function safeLogString(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.replace(/[\r\n\t]+/g, " ").slice(0, 200);
}
