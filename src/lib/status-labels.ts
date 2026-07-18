/**
 * Status label translations for Arabic locale.
 * Used by StatusBadges when the UI is in Arabic.
 */
export const statusLabelsAr: Record<string, string> = {
  ACTIVE: "نشط",
  INACTIVE: "غير نشط",
  TRIAL_ACTIVE: "تجربة نشطة",
  TRIALING: "تجربة",
  PENDING_ACTIVATION: "بانتظار التفعيل",
  PENDING_PAYMENT: "بانتظار الدفع",
  PENDING: "قيد الانتظار",
  DRAFT: "مسودة",
  NEW: "جديد",
  OPEN: "مفتوح",
  CONFIRMED: "مؤكد",
  PAID: "مدفوع",
  ON_TIME: "في الوقت",
  APPROVED: "تمت الموافقة",
  REJECTED: "مرفوض",
  CANCELLED: "ملغي",
  SUSPENDED: "معلق",
  OVERDUE: "متأخر",
  PAST_DUE: "متأخر",
  FAILED: "فشل",
  VOID: "ملغاة",
  EXPIRED: "منتهي",
  ISSUED: "صادرة",
  CONTACTED: "تم التواصل",
  IN_PROGRESS: "قيد التنفيذ",
  WAITING_CUSTOMER: "بانتظار العميل",
  GRACE_PERIOD: "فترة سماح",
  MANUAL_REVIEW: "مراجعة يدوية",
  QUALIFIED: "مؤهل",
  WON: "تم الفوز",
  LOST: "مفقود",
  CLOSED: "مغلق",
  RESOLVED: "تم الحل",
  COMPLETED: "مكتمل",
  ASSIGNED: "معين",
  AVAILABLE: "متاح",
  DAMAGED: "تالف",
  RETIRED: "متقاعد",
  RETURNED: "تم الإرجاع",
  VALID: "ساري",
  MISSING: "مفقود",
  LOCKED: "مقفل",
  REVIEW: "قيد المراجعة",
  LEAVE: "إجازة",
  ABSENT: "غياب",
  PRESENT: "حضور",
  LATE: "متأخر",
  EARLY_LEAVE: "انصراف مبكر",
};

export function getStatusLabel(status: string, locale?: string): string {
  if (locale === "ar") {
    return statusLabelsAr[status] ?? status.replace(/_/g, " ");
  }
  return status.replace(/_/g, " ");
}
