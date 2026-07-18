/**
 * Central locale-aware status label helper.
 * All enum/status text displayed to users MUST go through this function.
 */
export const statusLabelsAr: Record<string, string> = {
  // General
  ACTIVE: "نشط",
  INACTIVE: "غير نشط",
  PENDING: "قيد الانتظار",
  PENDING_ACTIVATION: "بانتظار التفعيل",
  PENDING_PAYMENT: "بانتظار الدفع",
  APPROVED: "تمت الموافقة",
  REJECTED: "مرفوض",
  CANCELLED: "ملغي",
  SUSPENDED: "موقوف",
  DRAFT: "مسودة",
  NEW: "جديد",
  OPEN: "مفتوحة",
  CONFIRMED: "مؤكد",
  LOCKED: "مغلق",
  REVIEW: "قيد المراجعة",
  COMPLETED: "مكتمل",
  EXPIRED: "منتهي",
  VALID: "ساري",
  MISSING: "مفقود",
  VOID: "ملغاة",

  // Billing / Subscription
  PAID: "مدفوعة",
  UNPAID: "غير مدفوعة",
  PARTIALLY_PAID: "مدفوعة جزئيًا",
  PAST_DUE: "متأخرة السداد",
  OVERDUE: "متأخرة",
  TRIAL_ACTIVE: "فترة تجريبية نشطة",
  TRIALING: "في فترة تجربة",
  GRACE_PERIOD: "فترة سماح",

  // Support
  IN_PROGRESS: "قيد المعالجة",
  RESOLVED: "تم الحل",
  CLOSED: "مغلقة",
  WAITING_CUSTOMER: "بانتظار العميل",
  MANUAL_REVIEW: "مراجعة يدوية",

  // Leads
  CONTACTED: "تم التواصل",
  QUALIFIED: "مؤهل",
  WON: "تم الفوز",
  LOST: "مفقود",

  // Attendance
  ON_TIME: "في الموعد",
  LATE: "متأخر",
  ABSENT: "غائب",
  EARLY_LEAVE: "انصراف مبكر",
  OVERTIME: "وقت إضافي",
  MISSING_CLOCK_OUT: "انصراف غير مسجل",
  OUTSIDE_GEOFENCE: "خارج النطاق الجغرافي",
  NO_SCHEDULE: "لا يوجد جدول",
  ON_LEAVE: "في إجازة",
  OFF: "راحة",
  LEAVE: "إجازة",
  PRESENT: "حاضر",

  // HR
  ASSIGNED: "معين",
  AVAILABLE: "متاح",
  DAMAGED: "تالف",
  RETIRED: "متقاعد",
  RETURNED: "تم الإرجاع",
};

export const statusLabelsEn: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  PENDING: "Pending",
  PENDING_ACTIVATION: "Pending Activation",
  PENDING_PAYMENT: "Pending Payment",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  SUSPENDED: "Suspended",
  DRAFT: "Draft",
  NEW: "New",
  OPEN: "Open",
  CONFIRMED: "Confirmed",
  LOCKED: "Locked",
  REVIEW: "Review",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
  VALID: "Valid",
  MISSING: "Missing",
  VOID: "Void",
  PAID: "Paid",
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially Paid",
  PAST_DUE: "Past Due",
  OVERDUE: "Overdue",
  TRIAL_ACTIVE: "Trial Active",
  TRIALING: "Trialing",
  GRACE_PERIOD: "Grace Period",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  WAITING_CUSTOMER: "Waiting for Customer",
  MANUAL_REVIEW: "Manual Review",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  WON: "Won",
  LOST: "Lost",
  ON_TIME: "On Time",
  LATE: "Late",
  ABSENT: "Absent",
  EARLY_LEAVE: "Early Leave",
  OVERTIME: "Overtime",
  MISSING_CLOCK_OUT: "Missing Clock Out",
  OUTSIDE_GEOFENCE: "Outside Geofence",
  NO_SCHEDULE: "No Schedule",
  ON_LEAVE: "On Leave",
  OFF: "Off",
  LEAVE: "Leave",
  PRESENT: "Present",
  ASSIGNED: "Assigned",
  AVAILABLE: "Available",
  DAMAGED: "Damaged",
  RETIRED: "Retired",
  RETURNED: "Returned",
};

export function getStatusLabel(status: string, locale?: string): string {
  if (locale === "ar") {
    return statusLabelsAr[status] ?? status.replace(/_/g, " ");
  }
  if (locale === "en") {
    return statusLabelsEn[status] ?? status.replace(/_/g, " ");
  }
  return status.replace(/_/g, " ");
}
