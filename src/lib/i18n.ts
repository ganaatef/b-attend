/**
 * B-Attend i18n — minimal English-first dictionary with Arabic stubs.
 * Phase 1: only `en` is wired into the UI. `ar` keys exist so Phase 8 can flip RTL.
 */

export type Locale = "en" | "ar";

type Dict = Record<string, string>;

const en: Dict = {
  "brand.name": "B-Attend",
  "brand.nameAr": "بي اتيند",
  "brand.tagline": "Be present. Be verified.",
  "brand.taglineAr": "حضور موثّق وورديات تحت السيطرة",
  "brand.positioning": "Smart attendance and shift control for operational teams",

  "nav.home": "Home",
  "nav.features": "Features",
  "nav.pricing": "Pricing",
  "nav.contact": "Contact",
  "nav.requestDemo": "Request Demo",
  "nav.login": "Login",
  "nav.getStarted": "Get Started",
  "nav.logout": "Logout",

  "footer.product": "Product",
  "footer.company": "Company",
  "footer.legal": "Legal",
  "footer.privacy": "Privacy Policy",
  "footer.terms": "Terms of Service",
  "footer.copyright": "© {year} B-Attend. Built for operational teams everywhere.",

  "cta.startTrial": "Start 14-day Trial",
  "cta.bookDemo": "Book a Demo",
  "cta.contactSales": "Contact Sales",
  "cta.viewPricing": "View Pricing",

  "plan.trial": "Trial",
  "plan.starter": "Starter",
  "plan.growth": "Growth",
  "plan.pro": "Pro",
  "plan.enterprise": "Enterprise",
  "plan.monthly": "Monthly",
  "plan.annual": "Annual",
  "plan.perMonth": "/mo",
  "plan.perYear": "/yr",
  "plan.custom": "Custom",
  "plan.choosePlan": "Choose {plan}",
  "plan.startTrial": "Start Trial",
  "plan.contactSales": "Contact Sales",

  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.submit": "Submit",
  "common.loading": "Loading...",
  "common.comingSoon": "Coming in Phase {phase}",
  "common.phase2": "Phase 2 — Super Admin control center",
};

const ar: Dict = {
  "brand.name": "بي اتيند",
  "brand.nameAr": "بي اتيند",
  "brand.tagline": "حضور موثّق وورديات تحت السيطرة",
  "brand.positioning": "نظام حضور وورديات ذكي للشركات والمطاعم",
  // TODO Phase 8: complete Arabic translations
};

const dicts: Record<Locale, Dict> = { en, ar };

export function t(key: string, locale: Locale = "en", vars?: Record<string, string | number>): string {
  const dict = dicts[locale] ?? en;
  let s = dict[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(`{${k}}`, String(v));
    }
  }
  return s;
}

export const defaultLocale: Locale = "en";
