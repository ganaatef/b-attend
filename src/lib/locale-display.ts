/**
 * Locale-aware display mappings for enum values, weekdays, shift names, etc.
 * Every raw DB value shown to users MUST go through this module.
 */

/* ── Weekday names ── */
export const weekdayLabelsAr: Record<string, string> = {
  MONDAY: "الإثنين",
  TUESDAY: "الثلاثاء",
  WEDNESDAY: "الأربعاء",
  THURSDAY: "الخميس",
  FRIDAY: "الجمعة",
  SATURDAY: "السبت",
  SUNDAY: "الأحد",
};

export const weekdayLabelsEn: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

/**
 * Display a comma-separated list of weekday codes (e.g. "FRIDAY,SATURDAY")
 * in the correct locale.
 */
export function displayWeekendDays(raw: string, locale?: string): string {
  if (!raw) return "—";
  const days = raw.split(",").map((d) => d.trim().toUpperCase());
  if (locale === "ar") {
    return days.map((d) => weekdayLabelsAr[d] ?? d).join("، ");
  }
  return days.map((d) => weekdayLabelsEn[d] ?? d).join(", ");
}

/* ── Shift / schedule name display ── */
export const shiftNameLabelsAr: Record<string, string> = {
  Morning: "وردية صباحية",
  Evening: "وردية مسائية",
  Night: "وردية ليلية",
  "Kitchen Double": "وردية مطبخ مزدوجة",
};

export const shiftNameLabelsEn: Record<string, string> = {
  Morning: "Morning Shift",
  Evening: "Evening Shift",
  Night: "Night Shift",
  "Kitchen Double": "Kitchen Double",
};

export function displayShiftName(name: string, locale?: string): string {
  if (locale === "ar") return shiftNameLabelsAr[name] ?? name;
  return shiftNameLabelsEn[name] ?? name;
}

/* ── Day part labels (for time-of-day context) ── */
export const dayPartLabelsAr: Record<string, string> = {
  Morning: "صباحًا",
  Evening: "مساءً",
  Night: "ليلًا",
};

export const dayPartLabelsEn: Record<string, string> = {
  Morning: "Morning",
  Evening: "Evening",
  Night: "Night",
};

export function displayDayPart(part: string, locale?: string): string {
  if (locale === "ar") return dayPartLabelsAr[part] ?? part;
  return dayPartLabelsEn[part] ?? part;
}

/* ── Status display (supplements status-labels.ts for extra statuses) ── */
export const approvalTypeLabelsAr: Record<string, string> = {
  LEAVE: "إجازة",
  OVERTIME: "عمل إضافي",
  SHIFT_CHANGE: "تغيير وردية",
  EXPENSE: "مصروفات",
  OTHER: "أخرى",
};

export const approvalTypeLabelsEn: Record<string, string> = {
  LEAVE: "Leave",
  OVERTIME: "Overtime",
  SHIFT_CHANGE: "Shift Change",
  EXPENSE: "Expense",
  OTHER: "Other",
};

export function displayApprovalType(type: string, locale?: string): string {
  if (locale === "ar") return approvalTypeLabelsAr[type] ?? type.replace(/_/g, " ");
  return approvalTypeLabelsEn[type] ?? type.replace(/_/g, " ");
}

/* ── Training category labels ── */
export const trainingCategoryLabelsAr: Record<string, string> = {
  SAFETY: "السلامة",
  ONBOARDING: "التوعية",
  COMPLIANCE: "الالتزام",
  SKILLS: "المهارات",
  PRODUCT: "المنتج",
  CUSTOMER_SERVICE: "خدمة العملاء",
  OTHER: "أخرى",
};

export const trainingCategoryLabelsEn: Record<string, string> = {
  SAFETY: "Safety",
  ONBOARDING: "Onboarding",
  COMPLIANCE: "Compliance",
  SKILLS: "Skills",
  PRODUCT: "Product",
  CUSTOMER_SERVICE: "Customer Service",
  OTHER: "Other",
};

export function displayTrainingCategory(cat: string, locale?: string): string {
  if (locale === "ar") return trainingCategoryLabelsAr[cat] ?? cat.replace(/_/g, " ");
  return trainingCategoryLabelsEn[cat] ?? cat.replace(/_/g, " ");
}

/* ── Payment method labels ── */
export const paymentMethodLabelsAr: Record<string, string> = {
  BANK_TRANSFER: "تحويل بنكي",
  CASH: "نقدي",
  MOBILE_WALLET: "محفولة إلكترونية",
  CHEQUE: "شيك",
};

export const paymentMethodLabelsEn: Record<string, string> = {
  BANK_TRANSFER: "Bank Transfer",
  CASH: "Cash",
  MOBILE_WALLET: "Mobile Wallet",
  CHEQUE: "Cheque",
};

export function displayPaymentMethod(method: string, locale?: string): string {
  if (locale === "ar") return paymentMethodLabelsAr[method] ?? method.replace(/_/g, " ");
  return paymentMethodLabelsEn[method] ?? method.replace(/_/g, " ");
}

/* ── Contract type labels ── */
export const contractTypeLabelsAr: Record<string, string> = {
  FULL_TIME: "دوام كامل",
  PART_TIME: "دوام جزئي",
  DAILY_WORKER: "عميل يومي",
  TEMPORARY: "مؤقت",
  CONTRACTOR: "مقاول",
  INTERN: "تدريب",
};

export const contractTypeLabelsEn: Record<string, string> = {
  FULL_TIME: "Full Time",
  PART_TIME: "Part Time",
  DAILY_WORKER: "Daily Worker",
  TEMPORARY: "Temporary",
  CONTRACTOR: "Contractor",
  INTERN: "Internship",
};

export function displayContractType(type: string, locale?: string): string {
  if (locale === "ar") return contractTypeLabelsAr[type] ?? type.replace(/_/g, " ");
  return contractTypeLabelsEn[type] ?? type.replace(/_/g, " ");
}

/* ── Employment type labels ── */
export function displayEmploymentType(type: string, locale?: string): string {
  return displayContractType(type, locale);
}

/* ── Document type labels ── */
export const documentTypeLabelsAr: Record<string, string> = {
  NATIONAL_ID: "رقم الهوية",
  PASSPORT: "جواز السفر",
  WORK_PERMIT: "تصريح العمل",
  HEALTH_CERTIFICATE: "شهادة صحية",
  FOOD_SAFETY: "شهادة سلامة غذائية",
  CONTRACT_DOC: "عقد",
  INSURANCE: "استمارة التأمين",
  MEDICAL: "شهادة طبية",
  OTHER: "أخرى",
};

export const documentTypeLabelsEn: Record<string, string> = {
  NATIONAL_ID: "National ID",
  PASSPORT: "Passport",
  WORK_PERMIT: "Work Permit",
  HEALTH_CERTIFICATE: "Health Certificate",
  FOOD_SAFETY: "Food Safety Certificate",
  CONTRACT_DOC: "Contract",
  INSURANCE: "Insurance Form",
  MEDICAL: "Medical Certificate",
  OTHER: "Other",
};

export function displayDocumentType(type: string, locale?: string): string {
  if (locale === "ar") return documentTypeLabelsAr[type] ?? type.replace(/_/g, " ");
  return documentTypeLabelsEn[type] ?? type.replace(/_/g, " ");
}

/* ── Warning type labels ── */
export const warningTypeLabelsAr: Record<string, string> = {
  ATTENDANCE: "الحضور",
  BEHAVIOR: "السلوك",
  POLICY: "السياسة",
  SAFETY: "الأمان",
  CASHIER: "الكاشير",
  CUSTOMER_COMplaint: "شكوى عميل",
  UNIFORM: "يونيفورم",
};

export const warningTypeLabelsEn: Record<string, string> = {
  ATTENDANCE: "Attendance",
  BEHAVIOR: "Behavior",
  POLICY: "Policy",
  SAFETY: "Safety",
  CASHIER: "Cashier",
  CUSTOMER_COMplaint: "Customer Complaint",
  UNIFORM: "Uniform",
};

export function displayWarningType(type: string, locale?: string): string {
  if (locale === "ar") return warningTypeLabelsAr[type] ?? type.replace(/_/g, " ");
  return warningTypeLabelsEn[type] ?? type.replace(/_/g, " ");
}

/* ── Business type labels ── */
export const businessTypeLabelsAr: Record<string, string> = {
  restaurant: "مطعم",
  cafe: "مقهى",
  retail: "تجزئة",
  gym: "صالة رياضية",
  clinic: "عيادة",
  warehouse: "مستودع",
  security: "أمن",
  cleaning: "نظافة",
  other: "أخرى",
};

export const businessTypeLabelsEn: Record<string, string> = {
  restaurant: "Restaurant",
  cafe: "Cafe",
  retail: "Retail",
  gym: "Gym",
  clinic: "Clinic",
  warehouse: "Warehouse",
  security: "Security",
  cleaning: "Cleaning",
  other: "Other",
};

export function displayBusinessType(type: string, locale?: string): string {
  if (locale === "ar") return businessTypeLabelsAr[type] ?? type.replace(/_/g, " ");
  return businessTypeLabelsEn[type] ?? type.replace(/_/g, " ");
}

/* ── Coach theme labels ── */
export const coachThemeLabelsAr: Record<string, string> = {
  ATTENDANCE: "الحضور",
  CUSTOMER_SERVICE: "خدمة العملاء",
  TEAMWORK: "العمل الجماعي",
  PRODUCTIVITY: "الإنتاجية",
  SAFETY: "الأمان",
  LEADERSHIP: "القيادة",
  MOTIVATION: "التحفيز",
  COMMUNICATION: "التواصل",
};

export const coachThemeLabelsEn: Record<string, string> = {
  ATTENDANCE: "Attendance",
  CUSTOMER_SERVICE: "Customer Service",
  TEAMWORK: "Teamwork",
  PRODUCTIVITY: "Productivity",
  SAFETY: "Safety",
  LEADERSHIP: "Leadership",
  MOTIVATION: "Motivation",
  COMMUNICATION: "Communication",
};

export function displayCoachTheme(theme: string, locale?: string): string {
  if (locale === "ar") return coachThemeLabelsAr[theme] ?? theme.replace(/_/g, " ");
  return coachThemeLabelsEn[theme] ?? theme.replace(/_/g, " ");
}

/* ── Coach audience labels ── */
export const coachAudienceLabelsAr: Record<string, string> = {
  ALL: "الكل",
  MANAGERS: "المديرون",
  EMPLOYEES: "الموظفون",
  NEW_HIRES: "الجدد",
  KITCHEN: "المطبخ",
  FRONT_OF_HOUSE: "الواجهة",
};

export const coachAudienceLabelsEn: Record<string, string> = {
  ALL: "All",
  MANAGERS: "Managers",
  EMPLOYEES: "Employees",
  NEW_HIRES: "New Hires",
  KITCHEN: "Kitchen",
  FRONT_OF_HOUSE: "Front of House",
};

export function displayCoachAudience(audience: string, locale?: string): string {
  if (locale === "ar") return coachAudienceLabelsAr[audience] ?? audience.replace(/_/g, " ");
  return coachAudienceLabelsEn[audience] ?? audience.replace(/_/g, " ");
}

/* ── Punch type labels ── */
export const punchTypeLabelsAr: Record<string, string> = {
  CLOCK_IN: "تسجيل حضور",
  CLOCK_OUT: "تسجيل انصراف",
};

export const punchTypeLabelsEn: Record<string, string> = {
  CLOCK_IN: "Clock In",
  CLOCK_OUT: "Clock Out",
};

export function displayPunchType(type: string, locale?: string): string {
  if (locale === "ar") return punchTypeLabelsAr[type] ?? type.replace(/_/g, " ");
  return punchTypeLabelsEn[type] ?? type.replace(/_/g, " ");
}

/* ── Audit action labels ── */
export const auditActionLabelsAr: Record<string, string> = {
  CREATE: "إنشاء",
  UPDATE: "تحديث",
  DELETE: "حذف",
  LOGIN: "تسجيل دخول",
  LOGOUT: "تسجيل خروج",
  APPROVE: "موافقة",
  REJECT: "رفض",
  EXPORT: "تصدير",
  IMPORT: "استيراد",
};

export const auditActionLabelsEn: Record<string, string> = {
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
  LOGIN: "Login",
  LOGOUT: "Logout",
  APPROVE: "Approve",
  REJECT: "Reject",
  EXPORT: "Export",
  IMPORT: "Import",
};

export function displayAuditAction(action: string, locale?: string): string {
  if (locale === "ar") return auditActionLabelsAr[action] ?? action.replace(/_/g, " ");
  return auditActionLabelsEn[action] ?? action.replace(/_/g, " ");
}

/* ── Lead source labels ── */
export const leadSourceLabelsAr: Record<string, string> = {
  WEBSITE: "الموقع",
  DEMO_REQUEST: "طلب عرض تجريبي",
  CONTACT: "التواصل",
  REFERRAL: "إحالة",
  OTHER: "أخرى",
};

export const leadSourceLabelsEn: Record<string, string> = {
  WEBSITE: "Website",
  DEMO_REQUEST: "Demo Request",
  CONTACT: "Contact",
  REFERRAL: "Referral",
  OTHER: "Other",
};

export function displayLeadSource(source: string, locale?: string): string {
  if (locale === "ar") return leadSourceLabelsAr[source] ?? source.replace(/_/g, " ");
  return leadSourceLabelsEn[source] ?? source.replace(/_/g, " ");
}

/* ── Support ticket status (extra) ── */
export const ticketStatusLabelsAr: Record<string, string> = {
  OPEN: "مفتوحة",
  IN_PROGRESS: "قيد المعالجة",
  WAITING_CUSTOMER: "بانتظار العميل",
  RESOLVED: "تم الحل",
  CLOSED: "مغلقة",
};

export const ticketStatusLabelsEn: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_CUSTOMER: "Waiting for Customer",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export function displayTicketStatus(status: string, locale?: string): string {
  if (locale === "ar") return ticketStatusLabelsAr[status] ?? status.replace(/_/g, " ");
  return ticketStatusLabelsEn[status] ?? status.replace(/_/g, " ");
}

/* ── Author role labels ── */
export const authorRoleLabelsAr: Record<string, string> = {
  CUSTOMER: "العميل",
  SUPPORT: "الدعم الفني",
  SYSTEM: "النظام",
};

export const authorRoleLabelsEn: Record<string, string> = {
  CUSTOMER: "Customer",
  SUPPORT: "Support",
  SYSTEM: "System",
};

export function displayAuthorRole(role: string, locale?: string): string {
  if (locale === "ar") return authorRoleLabelsAr[role] ?? role.replace(/_/g, " ");
  return authorRoleLabelsEn[role] ?? role.replace(/_/g, " ");
}

/* ── Invoice status labels ── */
export const invoiceStatusLabelsAr: Record<string, string> = {
  DRAFT: "مسودة",
  PENDING: "قيد الانتظار",
  PAID: "مدفوعة",
  UNPAID: "غير مدفوعة",
  PARTIALLY_PAID: "مدفوعة جزئيًا",
  PAST_DUE: "متأخرة السداد",
  OVERDUE: "متأخرة",
  VOID: "ملغاة",
};

export const invoiceStatusLabelsEn: Record<string, string> = {
  DRAFT: "Draft",
  PENDING: "Pending",
  PAID: "Paid",
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially Paid",
  PAST_DUE: "Past Due",
  OVERDUE: "Overdue",
  VOID: "Void",
};

export function displayInvoiceStatus(status: string, locale?: string): string {
  if (locale === "ar") return invoiceStatusLabelsAr[status] ?? status.replace(/_/g, " ");
  return invoiceStatusLabelsEn[status] ?? status.replace(/_/g, " ");
}

/* ── Payment provider labels ── */
export const paymentProviderLabelsAr: Record<string, string> = {
  STRIPE: "Stripe",
  PAYPAL: "PayPal",
  MANUAL: "يدوي",
};

export const paymentProviderLabelsEn: Record<string, string> = {
  STRIPE: "Stripe",
  PAYPAL: "PayPal",
  MANUAL: "Manual",
};

export function displayPaymentProvider(provider: string, locale?: string): string {
  if (locale === "ar") return paymentProviderLabelsAr[provider] ?? provider.replace(/_/g, " ");
  return paymentProviderLabelsEn[provider] ?? provider.replace(/_/g, " ");
}

/* ── AI feature labels ── */
export const aiFeatureLabelsAr: Record<string, string> = {
  DAILY_BRIEFING: "التقرير اليومي",
  COACH_TIPS: "نصائح التدريب",
  TEAM_SUMMARY: "ملخص الفريق",
  EMPLOYEE_SUMMARY: "ملخص الموظف",
  SCHEDULE_SUGGESTION: "اقتراح الجدول",
};

export const aiFeatureLabelsEn: Record<string, string> = {
  DAILY_BRIEFING: "Daily Briefing",
  COACH_TIPS: "Coach Tips",
  TEAM_SUMMARY: "Team Summary",
  EMPLOYEE_SUMMARY: "Employee Summary",
  SCHEDULE_SUGGESTION: "Schedule Suggestion",
};

export function displayAiFeature(feature: string, locale?: string): string {
  if (locale === "ar") return aiFeatureLabelsAr[feature] ?? feature.replace(/_/g, " ");
  return aiFeatureLabelsEn[feature] ?? feature.replace(/_/g, " ");
}

/* ── Briefing theme labels ── */
export const briefingThemeLabelsAr: Record<string, string> = {
  ATTENDANCE: "الحضور",
  PERFORMANCE: "الأداء",
  TEAM: "الفريق",
  SAFETY: "الأمان",
  CUSTOM: "مخصص",
};

export const briefingThemeLabelsEn: Record<string, string> = {
  ATTENDANCE: "Attendance",
  PERFORMANCE: "Performance",
  TEAM: "Team",
  SAFETY: "Safety",
  CUSTOM: "Custom",
};

export function displayBriefingTheme(theme: string, locale?: string): string {
  if (locale === "ar") return briefingThemeLabelsAr[theme] ?? theme.replace(/_/g, " ");
  return briefingThemeLabelsEn[theme] ?? theme.replace(/_/g, " ");
}

/* ── Coach score level labels ── */
export const scoreLevelLabelsAr: Record<string, string> = {
  EXCELLENT: "ممتاز",
  GOOD: "جيد",
  AVERAGE: "متوسط",
  NEEDS_IMPROVEMENT: "يحتاج تحسين",
};

export const scoreLevelLabelsEn: Record<string, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  AVERAGE: "Average",
  NEEDS_IMPROVEMENT: "Needs Improvement",
};

export function displayScoreLevel(level: string, locale?: string): string {
  if (locale === "ar") return scoreLevelLabelsAr[level] ?? level.replace(/_/g, " ");
  return scoreLevelLabelsEn[level] ?? level.replace(/_/g, " ");
}

/* ── Offboarding step status labels ── */
export const offboardingStepLabelsAr: Record<string, string> = {
  PENDING: "قيد الانتظار",
  IN_PROGRESS: "قيد التنفيذ",
  COMPLETED: "مكتمل",
  SKIPPED: "تم التخطي",
};

export const offboardingStepLabelsEn: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  SKIPPED: "Skipped",
};

export function displayOffboardingStep(step: string, locale?: string): string {
  if (locale === "ar") return offboardingStepLabelsAr[step] ?? step.replace(/_/g, " ");
  return offboardingStepLabelsEn[step] ?? step.replace(/_/g, " ");
}

/* ── Support level labels ── */
export const supportLevelLabelsAr: Record<string, string> = {
  basic: "أساسي",
  standard: "قياسي",
  premium: "متميز",
  enterprise: "مؤسسات",
};

export const supportLevelLabelsEn: Record<string, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
  enterprise: "Enterprise",
};

export function displaySupportLevel(level: string, locale?: string): string {
  if (locale === "ar") return supportLevelLabelsAr[level] ?? level.replace(/_/g, " ");
  return supportLevelLabelsEn[level] ?? level.replace(/_/g, " ");
}
