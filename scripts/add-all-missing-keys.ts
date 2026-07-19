/**
 * Add ALL missing translation keys to en.json and ar.json.
 * Run: npx tsx scripts/add-all-missing-keys.ts
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const enPath = resolve("messages/en.json");
const arPath = resolve("messages/ar.json");

const en = JSON.parse(readFileSync(enPath, "utf-8"));
const ar = JSON.parse(readFileSync(arPath, "utf-8"));

function merge(target: Record<string, any>, source: Record<string, any>) {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      merge(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

/* ── policies ── */
merge(en.policies, {
  nameRequired: "Policy name is required",
  startRequired: "Start time is required",
  endRequired: "End time is required",
  breakLabel: "Break (minutes)",
  lateGraceLabel: "Late grace (minutes)",
  earlyLeaveGraceLabel: "Early-leave grace (minutes)",
  overtimeAfterLabel: "Overtime starts after (minutes)",
  weekendDaysLabel: "Weekend days",
  otApproval: "Require overtime approval",
  mobileLabel: "Allow mobile clock-in",
  kioskLabel: "Allow kiosk clock-in",
  placeholderName: "e.g. Morning Shift",
  countEmployees: "{count} employees",
  countSchedules: "{count} schedules",
  overnightShift: "Overnight shift",
  weekdays: {
    MONDAY: "Monday", TUESDAY: "Tuesday", WEDNESDAY: "Wednesday",
    THURSDAY: "Thursday", FRIDAY: "Friday", SATURDAY: "Saturday", SUNDAY: "Sunday",
  },
  validation: {
    nameRequired: "Policy name is required",
    startRequired: "Start time is required",
    endRequired: "End time is required",
  },
});

merge(ar.policies, {
  nameRequired: "اسم السياسة مطلوب",
  startRequired: "وقت بداية الوردية مطلوب",
  endRequired: "وقت نهاية الوردية مطلوب",
  breakLabel: "مدة الاستراحة (دقيقة)",
  lateGraceLabel: "فترة السماح بالتأخير (دقيقة)",
  earlyLeaveGraceLabel: "فترة السماح بالانصراف المبكر (دقيقة)",
  overtimeAfterLabel: "يبدأ احتساب العمل الإضافي بعد (دقيقة)",
  weekendDaysLabel: "أيام العطلة الأسبوعية",
  otApproval: "يتطلب موافقة على العمل الإضافي",
  mobileLabel: "السماح بالتسجيل من الهاتف",
  kioskLabel: "السماح بالتسجيل من جهاز الحضور",
  placeholderName: "مثال: وردية صباحية",
  countEmployees: "{count} موظف",
  countSchedules: "{count} جدول",
  overnightShift: "وردية ليلية",
  weekdays: {
    MONDAY: "الإثنين", TUESDAY: "الثلاثاء", WEDNESDAY: "الأربعاء",
    THURSDAY: "الخميس", FRIDAY: "الجمعة", SATURDAY: "السبت", SUNDAY: "الأحد",
  },
  validation: {
    nameRequired: "اسم السياسة مطلوب",
    startRequired: "وقت بداية الوردية مطلوب",
    endRequired: "وقت نهاية الوردية مطلوب",
  },
});

/* ── branches ── */
merge(en.branches, {
  cityLabel: "City", addressLabel: "Address",
  geofenceRadiusLabel: "Geofence radius (meters)",
  latitudeLabel: "Latitude", longitudeLabel: "Longitude", areaLabel: "Area",
});
merge(ar.branches, {
  cityLabel: "المدينة", addressLabel: "العنوان",
  geofenceRadiusLabel: "نصف قطر النطاق الجغرافي (متر)",
  latitudeLabel: "خط العرض", longitudeLabel: "خط الطول", areaLabel: "المنطقة",
});

/* ── schedules ── */
merge(en.schedules, {
  selectPlaceholder: "Select...",
  shiftPolicyLabelFull: "Shift policy",
  dateFrom: "From date", dateTo: "To date",
  saving: "Saving...", duration: "Duration",
  durationLabel: "{h}h {m}m",
});
merge(ar.schedules, {
  selectPlaceholder: "اختر...",
  shiftPolicyLabelFull: "سياسة الوردية",
  dateFrom: "من تاريخ", dateTo: "إلى تاريخ",
  saving: "جاري الحفظ...", duration: "المدة",
  durationLabel: "{h} ساعة {m} دقيقة",
});

/* ── users ── */
merge(en.users, {
  nameRequired: "Name is required", emailRequired: "Email is required",
  roleRequired: "Role is required",
  branchForManagers: "Branch (required for managers)",
  saving: "Saving...",
});
merge(ar.users, {
  nameRequired: "الاسم مطلوب", emailRequired: "البريد الإلكتروني مطلوب",
  roleRequired: "الدور مطلوب",
  branchForManagers: "الفرع (مطلوب للمديرين)",
  saving: "جاري الحفظ...",
});

/* ── approvals ── */
merge(en.approvals, { status: "Status" });
merge(ar.approvals, { status: "الحالة" });

/* ── employees ── */
merge(en.employees, { inactive: "Inactive" });
merge(ar.employees, { inactive: "غير نشط" });

/* ── tenant ── */
merge(en.tenant, { signOut: "Sign out" });
merge(ar.tenant, { signOut: "تسجيل الخروج" });

/* ── profile ── */
merge(en.profile, { branch: "Branch" });
merge(ar.profile, { branch: "الفرع" });

/* ── hrTraining ── */
merge(en.hrTraining, {
  newTrainingAssignment: "New Training Assignment",
  assignmentDetails: "Assignment Details",
  employeeRequired: "Employee is required",
  selectEmployee: "Select employee",
  courseRequired: "Course is required",
  selectCourse: "Select course",
  notes: "Notes", cancel: "Cancel", assigning: "Assigning...",
  trainingAssignment: "Training Assignment",
  branch: "Branch", assignedDate: "Assigned Date",
  actions: "Actions", markInProgress: "Mark In Progress",
  scorePercent: "Score (%)", optional: "Optional",
  markCompleted: "Mark Completed",
  newTrainingCourse: "New Training Course",
  courseDetails: "Course Details",
  titleRequired: "Title is required",
  courseDescription: "Description",
  categoryRequired: "Category is required",
  requiredForJobTitle: "Required for job title",
  creating: "Creating...", createCourse: "Create Course",
  validity: "Validity", months: "months", noExpiry: "No expiry",
  deactivate: "Deactivate", activate: "Activate",
  total: "Total", all: "All",
  monthsValidity: "{n} months validity",
});
merge(ar.hrTraining, {
  newTrainingAssignment: "تكليف تدريب جديد",
  assignmentDetails: "تفاصيل التكليف",
  employeeRequired: "الموظف مطلوب",
  selectEmployee: "اختر موظف",
  courseRequired: "المقرر مطلوب",
  selectCourse: "اختر مقرر",
  notes: "ملاحظات", cancel: "إلغاء", assigning: "جاري التكليف...",
  trainingAssignment: "تكليف تدريب",
  branch: "الفرع", assignedDate: "تاريخ التكليف",
  actions: "الإجراءات", markInProgress: "بدء التنفيذ",
  scorePercent: "الدرجة (%)", optional: "اختياري",
  markCompleted: "إكمال",
  newTrainingCourse: "مقرر تدريب جديد",
  courseDetails: "تفاصيل المقرر",
  titleRequired: "العنوان مطلوب",
  courseDescription: "الوصف",
  categoryRequired: "الفئة مطلوبة",
  requiredForJobTitle: "مطلوب لوظيفة",
  creating: "جاري الإنشاء...", createCourse: "إنشاء مقرر",
  validity: "الصلاحية", months: "أشهر", noExpiry: "بدون انتهاء",
  deactivate: "إلغاء التنشيط", activate: "تنشيط",
  total: "المجموع", all: "الكل",
  monthsValidity: "صلاحية {n} أشهر",
});

/* ── hrWarnings ── */
merge(en.hrWarnings, { cancel: "Cancel" });
merge(ar.hrWarnings, { cancel: "إلغاء" });

/* ── hrOffboarding ── */
merge(en.hrOffboarding, {
  progress: "Progress", dueLabel: "Due",
  complete: "Complete", cancel: "Cancel",
});
merge(ar.hrOffboarding, {
  progress: "التقدم", dueLabel: "الموعد",
  complete: "إكمال", cancel: "إلغاء",
});

/* ── hrContracts ── */
merge(en.hrContracts, { cancel: "Cancel" });
merge(ar.hrContracts, { cancel: "إلغاء" });

/* ── hrPayrollProfiles ── */
merge(en.hrPayrollProfiles, { noBranch: "No branch assigned", cancel: "Cancel" });
merge(ar.hrPayrollProfiles, { noBranch: "لم يتم تعيين فرع", cancel: "إلغاء" });

/* ── hrPayrollRuns ── */
merge(en.hrPayrollRuns, { notes: "Notes", all: "All" });
merge(ar.hrPayrollRuns, { notes: "ملاحظات", all: "الكل" });

/* ── hrDocuments ── */
merge(en.hrDocuments, {
  foodSafetyCertificate: "Food Safety Certificate",
  insuranceForm: "Insurance Form",
  medicalCertificate: "Medical Certificate",
  notesLabel: "Notes", optionalNotes: "Optional notes",
});
merge(ar.hrDocuments, {
  foodSafetyCertificate: "شهادة سلامة غذائية",
  insuranceForm: "استمارة التأمين",
  medicalCertificate: "شهادة طبية",
  notesLabel: "ملاحظات", optionalNotes: "ملاحظات اختيارية",
});

/* ── hrAssets ── */
merge(en.hrAssets, { adding: "Adding..." });
merge(ar.hrAssets, { adding: "جاري الإضافة..." });

/* ── myAssets ── */
merge(en.myAssets, { myAssetsSubtitle: "Assets assigned to you" });
merge(ar.myAssets, { myAssetsSubtitle: "الأصول المعينة لك" });

/* ── myLeave ── */
merge(en.myLeave, { myLeaveSubtitle: "View and request leaves" });
merge(ar.myLeave, { myLeaveSubtitle: "عرض وطلب الإجازات" });

/* ── myTraining ── */
merge(en.myTraining, { myTrainingSubtitle: "Your training assignments" });
merge(ar.myTraining, { myTrainingSubtitle: "تكليفات التدريب الخاصة بك" });

/* ── myWarnings ── */
merge(en.myWarnings, { myWarningsSubtitle: "Your warnings and notices" });
merge(ar.myWarnings, { myWarningsSubtitle: "تحذيراتك وإشعاراتك" });

/* ── pricing ── */
merge(en.pricing, { branches: "Branches" });
merge(ar.pricing, { branches: "الفروع" });

/* ── landing ── */
merge(en.landing, { liveAttendance: "Live Attendance" });
merge(ar.landing, { liveAttendance: "الحضور المباشر" });

/* ── adminInvoices ── */
merge(en.adminInvoices, {
  bankTransfer: "Bank Transfer", cash: "Cash", manual: "Manual",
  markPaid: "Mark Paid", voidConfirm: "Are you sure you want to void this invoice?",
});
merge(ar.adminInvoices, {
  bankTransfer: "تحويل بنكي", cash: "نقدي", manual: "يدوي",
  markPaid: "تحديد كمدفوعة", voidConfirm: "هل أنت متأكد من إلغاء هذه الفاتورة؟",
});

/* ── adminLeads ── */
merge(en.adminLeads, { assignPlaceholder: "Select assignee", unassigned: "Unassigned" });
merge(ar.adminLeads, { assignPlaceholder: "اختر المسؤول", unassigned: "غير مسؤول" });

/* ── admin dashboard ── */
merge(en.admin, {
  totalCompanies: "Total Companies",
  active: "active", trial: "trial",
  pendingActivation: "Pending Activation",
  awaitingReview: "Awaiting Review",
  suspended: "Suspended", actionRequired: "Action Required",
  mrr: "MRR", arr: "ARR",
  pendingInvoices: "Pending Invoices", overdue: "overdue",
  openTickets: "Open Tickets", supportQueue: "Support Queue",
  activeEmployees: "Active Employees",
  clockActionsToday: "Clock Actions Today",
  acrossAllTenants: "Across all tenants",
  superAdminTitle: "Super Admin Control Center",
  superAdminSubtitle: "Platform-wide metrics, tenant management, billing, and support controls.",
  recentTenants: "Recent Tenants", viewAll: "View all →",
  noTenants: "No tenants yet",
  recentLeads: "Recent Leads ({count} new)", noLeads: "No leads yet",
  recentInvoices: "Recent Invoices", noInvoices: "No invoices yet",
  supportTickets: "Support Tickets", noTickets: "No tickets yet",
  quickActions: "Quick Actions",
  manageTenants: "Manage tenants", manageTenantsDesc: "Activate, suspend, cancel",
  billingInvoices: "Billing & invoices", billingInvoicesDesc: "Create invoices, mark paid",
  leadsAction: "Leads", leadsActionDesc: "Demo requests & contacts",
  plansFeatures: "Plans & features", plansFeaturesDesc: "{count} plans active",
});
merge(ar.admin, {
  totalCompanies: "إجمالي الشركات",
  active: "نشط", trial: "تجريبي",
  pendingActivation: "بانتظار التفعيل",
  awaitingReview: "بانتظار المراجعة",
  suspended: "موقوف", actionRequired: "يتطلب إجراء",
  mrr: "الإيراد الشهري", arr: "الإيراد السنوي",
  pendingInvoices: "فواتير معلقة", overdue: "متأخرة",
  openTickets: "تذاكر مفتوحة", supportQueue: "قائمة الدعم",
  activeEmployees: "الموظفون النشطون",
  clockActionsToday: "تسجيلات الحضور اليوم",
  acrossAllTenants: "عبر جميع الشركات",
  superAdminTitle: "مركز التحكم للمسؤول العام",
  superAdminSubtitle: "بيانات شاملة للمنصة، وإدارة الشركات، والفواتير، والدعم الفني.",
  recentTenants: "الشركات الأخيرة", viewAll: "عرض الكل →",
  noTenants: "لا توجد شركات بعد",
  recentLeads: "العملاء المحتملون ({count} جديد)", noLeads: "لا يوجد عملاء محتملون بعد",
  recentInvoices: "الفواتير الأخيرة", noInvoices: "لا توجد فواتير بعد",
  supportTickets: "تذاكر الدعم", noTickets: "لا توجد تذاكر بعد",
  quickActions: "إجراءات سريعة",
  manageTenants: "إدارة الشركات", manageTenantsDesc: "تفعيل، تعليق، إلغاء",
  billingInvoices: "الفواتير والسداد", billingInvoicesDesc: "إنشاء فواتير، تحديد مدفوعة",
  leadsAction: "العملاء المحتملون", leadsActionDesc: "طلبات العروض والتواصل",
  plansFeatures: "الباقات والميزات", plansFeaturesDesc: "{count} باقة نشطة",
});

/* ── pricing/trialDays ── */
merge(en.pricing, { trialDays: "{days}-day free trial" });
merge(ar.pricing, { trialDays: "تجربة مجانية لمدة {days} أيام" });

writeFileSync(enPath, JSON.stringify(en, null, 2) + "\n", "utf-8");
writeFileSync(arPath, JSON.stringify(ar, null, 2) + "\n", "utf-8");

/* Count keys */
function countKeys(obj: any): number {
  let count = 0;
  for (const v of Object.values(obj)) {
    if (typeof v === "object" && v !== null && !Array.isArray(v)) count += countKeys(v);
    else count++;
  }
  return count;
}

console.log(`EN keys: ${countKeys(en)}`);
console.log(`AR keys: ${countKeys(ar)}`);
console.log("Done — files updated.");
