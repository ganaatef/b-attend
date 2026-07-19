#!/usr/bin/env tsx
/**
 * Add all missing translation keys with proper EN + AR translations.
 * Run: npx tsx scripts/add-missing-keys.ts
 */
import fs from "fs";

const enPath = "messages/en.json";
const arPath = "messages/ar.json";

const en: Record<string, any> = JSON.parse(fs.readFileSync(enPath, "utf-8"));
const ar: Record<string, any> = JSON.parse(fs.readFileSync(arPath, "utf-8"));

function setIfMissing(obj: Record<string, any>, ns: string, key: string, enVal: string, arVal: string) {
  if (!obj[ns]) obj[ns] = {};
  if (!(key in obj[ns])) {
    obj[ns][key] = ns.startsWith("admin") ? enVal : undefined;
    if (obj === en) obj[ns][key] = enVal;
    else obj[ns][key] = arVal;
  }
}

function addKeys(ns: string, entries: [string, string, string][]) {
  for (const [key, enVal, arVal] of entries) {
    if (!en[ns]) en[ns] = {};
    if (!ar[ns]) ar[ns] = {};
    if (!(key in en[ns])) en[ns][key] = enVal;
    if (!(key in ar[ns])) ar[ns][key] = arVal;
  }
}

// ═══════════════════════════════════════════════════════
// ONBOARDING WIZARD
// ═══════════════════════════════════════════════════════
addKeys("onboarding", [
  ["wizardTitle", "Onboarding wizard", "معالج التأهيل"],
  ["wizardDesc", "Set up your company step by step.", "إعداد شركتك خطوة بخطوة."],
  ["tabProfile", "Profile", "الملف الشخصي"],
  ["tabBranch", "Branch", "الفرع"],
  ["tabDepartments", "Departments", "الأقسام"],
  ["tabPolicies", "Policies", "السياسات"],
  ["tabEmployees", "Employees", "الموظفون"],
  ["tabSchedules", "Schedules", "الجداول"],
  ["tabReview", "Review", "المراجعة"],
  ["companyNameLabel", "Company name", "اسم الشركة"],
  ["industryLabel", "Industry", "النشاط التجاري"],
  ["industryPlaceholder", "Restaurant", "مطعم"],
  ["timezoneLabel", "Timezone", "المنطقة الزمنية"],
  ["currencyLabel", "Currency", "العملة"],
  ["defaultLanguageLabel", "Default language", "اللغة الافتراضية"],
  ["profileSaved", "Profile saved.", "تم حفظ الملف الشخصي."],
  ["saveProfile", "Save profile", "حفظ الملف الشخصي"],
  ["branchNameLabel", "Branch name *", "اسم الفرع *"],
  ["codeLabel", "Code *", "الكود *"],
  ["codePlaceholder", "NC", "NC"],
  ["branchNamePlaceholder", "New Cairo", "القاهرة الجديدة"],
  ["addressLabel", "Address", "العنوان"],
  ["addressPlaceholder", "5th Settlement", "التجمع الخامس"],
  ["cityLabel", "City", "المدينة"],
  ["cityPlaceholder", "Cairo", "القاهرة"],
  ["latitudeLabel", "Latitude", "خط العرض"],
  ["latitudePlaceholder", "30.0254", "30.0254"],
  ["longitudeLabel", "Longitude", "خط الطول"],
  ["longitudePlaceholder", "31.4913", "31.4913"],
  ["geofenceRadiusLabel", "Geofence radius (m)", "نصف قطر الجيو فينس (م)"],
  ["addBranch", "Add branch", "إضافة فرع"],
  ["departmentsLabel", "Departments (comma-separated)", "الأقسام (مفصولة بفواصل)"],
  ["departmentsPlaceholder", "Kitchen, Service, Cashier, Delivery, Stewarding, Management", "مطبخ، خدمة، كاشير، توصيل، نظافة، إدارة"],
  ["createDepartments", "Create departments", "إنشاء الأقسام"],
  ["policyNameLabel", "Policy name *", "اسم السياسة *"],
  ["policyNamePlaceholder", "Morning", "صباحي"],
  ["startTimeLabel", "Start time *", "وقت البداية *"],
  ["endTimeLabel", "End time *", "وقت النهاية *"],
  ["breakMinLabel", "Break (min)", "استراحة (دقيقة)"],
  ["lateGraceMinLabel", "Late grace (min)", "فترة سماح التأخير (دقيقة)"],
  ["earlyLeaveGraceMinLabel", "Early leave grace (min)", "فترة سماح المغادرة المبكرة (دقيقة)"],
  ["overtimeAfterMinLabel", "Overtime after (min)", "العمل الإضافي بعد (دقيقة)"],
  ["createPolicy", "Create policy", "إنشاء سياسة"],
  ["employeeCodeLabel", "Employee code *", "كود الموظف *"],
  ["employeeCodePlaceholder", "EMP001", "EMP001"],
  ["fullNameLabel", "Full name *", "الاسم الكامل *"],
  ["fullNamePlaceholder", "Ahmed Mansour", "أحمد منصور"],
  ["phoneLabel", "Phone", "الهاتف"],
  ["phonePlaceholder", "+20 100 123 4567", "+20 100 123 4567"],
  ["emailLabel", "Email", "البريد الإلكتروني"],
  ["emailPlaceholder", "ahmed@example.com", "ahmed@example.com"],
  ["jobTitleLabel", "Job title", "المسمى الوظيفي"],
  ["jobTitlePlaceholder", "Waiter", "جرسون"],
  ["branchLabel", "Branch *", "الفرع *"],
  ["selectBranch", "Select", "اختر"],
  ["departmentLabel", "Department", "القسم"],
  ["shiftPolicyLabel", "Default shift policy", "سياسة الوردية الافتراضية"],
  ["pinLabel", "PIN (for kiosk", "PIN (للجهاز)"],
  ["pinPlaceholder", "0000", "0000"],
  ["addEmployee", "Add employee", "إضافة موظف"],
  ["goToEmployeeList", "Go to employee list →", "الذهاب لقائمة الموظفين →"],
  ["employeesAdded", "{count} employees added.", "تمت إضافة {count} موظف."],
  ["schedulesDesc", "Generate schedules for multiple employees across a date range. Weekends (Fri/Sat) are skipped by default.", "إنشاء جداول لأكثر من موظف في نطاق تاريخ. weekends (الجمعة/السبت) يتم تخطيها افتراضياً."],
  ["shiftPolicyLabelFull", "Shift policy *", "سياسة الوردية *"],
  ["dateFrom", "From *", "من *"],
  ["dateTo", "To *", "إلى *"],
  ["employeesLabel", "Employees *", "الموظفون *"],
  ["noEmployeesHint", "No employees. Add employees first.", "لا يوجد موظفون. أضف الموظفين أولاً."],
  ["selectEmployeesHint", "Select one or more employees. Employee IDs are submitted as a comma-joined string.", "اختر موظفاً أو أكثر. يتم إرسال أكواد الموظفين كنص مفصول بفواصل."],
  ["createdSchedules", "Created {created} schedules. Skipped {skipped} duplicates.", "تم إنشاء {created} جدول. تم تخطي {skipped} مكرر."],
  ["generateSchedules", "Generate schedules", "إنشاء الجداول"],
  ["companyProfile", "Company profile", "ملف الشركة"],
  ["branchesLabel", "Branches", "الفروع"],
  ["departmentsTitle", "Departments", "الأقسام"],
  ["shiftPoliciesLabel", "Shift policies", "سياسات الورديات"],
  ["employeesTitle", "Employees", "الموظفون"],
  ["setupProgress", "Your setup progress:", "تقدم الإعداد:"],
  ["goToDashboard", "Go to dashboard →", "الذهاب للوحة التحكم →"],
]);

// ═══════════════════════════════════════════════════════
// EMPLOYEES/[id]
// ═══════════════════════════════════════════════════════
addKeys("employees", [
  ["backToList", "← Employees", "← الموظفون"],
  ["profileTab", "Profile", "الملف الشخصي"],
  ["employeeCode", "Employee Code:", "كود الموظف:"],
  ["fullNameLabel", "Full Name:", "الاسم الكامل:"],
  ["arabicNameLabel", "Arabic Name:", "الاسم بالعربي:"],
  ["nationalIdLabel", "National ID:", "رقم الهوية:"],
  ["jobTitleLabel", "Job Title:", "المسمى الوظيفي:"],
  ["employmentTypeLabel", "Employment Type:", "نوع التوظيف:"],
  ["startDateLabel", "Start Date:", "تاريخ البداية:"],
  ["statusLabel", "Status:", "الحالة:"],
  ["tabOverview", "Overview", "نظرة عامة"],
  ["tabAttendance", "Attendance", "الحضور"],
  ["tabDocuments", "Documents", "المستندات"],
  ["tabContracts", "Contracts", "العقود"],
  ["tabLeave", "Leave", "الإجازات"],
  ["tabTraining", "Training", "التدريب"],
  ["tabAssets", "Assets", "الأصول"],
  ["tabWarnings", "Warnings", "التحذيرات"],
  ["tabPayroll", "Payroll", "الرواتب"],
  ["tabOnboarding", "Onboarding", "التأهيل"],
  ["tabOffboarding", "Offboarding", "الإنهاء"],
  ["tabAudit", "Audit", "سجل التدقيق"],
  ["monthlySummary", "This month summary", "ملخص هذا الشهر"],
  ["presentDays", "Present days", "أيام الحضور"],
  ["absentDays", "Absent days", "أيام الغياب"],
  ["lateMinutes", "Late minutes", "دقائق التأخير"],
  ["workedHours", "Worked hours", "ساعات العمل"],
  ["recentPunches", "Recent punches", "آخر البصمات"],
  ["documentsTitle", "Documents", "المستندات"],
  ["contractsTitle", "Contracts", "العقود"],
  ["leaveBalancesTitle", "Leave Balances ({year})", "أرصدة الإجازات ({year})"],
  ["leaveRequestsTitle", "Leave Requests", "طلبات الإجازة"],
  ["trainingAssignmentsTitle", "Training Assignments", "مهام التدريب"],
  ["assignedAssetsTitle", "Assigned Assets", "الأصول المخصصة"],
  ["warningsTitle", "Warnings", "التحذيرات"],
  ["payrollProfileTitle", "Payroll Profile", "ملف الرواتب"],
  ["recentPayrollLines", "Recent Payroll Lines", "بنود الرواتب الأخيرة"],
  ["recentAdjustments", "Recent Adjustments", "التعديلات الأخيرة"],
  ["onboardingTasks", "Onboarding Tasks", "مهام التأهيل"],
  ["offboardingTasks", "Offboarding Tasks", "مهام الإنهاء"],
  ["auditLog", "Audit Log", "سجل التدقيق"],
  ["noPunches", "No punches yet", "لا توجد بصمات بعد"],
  ["noDocuments", "No documents", "لا توجد مستندات"],
  ["noContracts", "No contracts", "لا توجد عقود"],
  ["noLeaveBalances", "No leave balances", "لا توجد أرصدة إجازات"],
  ["noLeaveRequests", "No leave requests", "لا توجد طلبات إجازة"],
  ["noTrainingAssignments", "No training assignments", "لا توجد مهام تدريب"],
  ["noAssetsAssigned", "No assets assigned", "لا توجد أصول مخصصة"],
  ["noWarnings", "No warnings", "لا توجد تحذيرات"],
  ["noPayrollProfile", "No payroll profile", "لا يوجد ملف رواتب"],
  ["noOnboardingTasks", "No onboarding tasks", "لا توجد مهام تأهيل"],
  ["noOffboardingTasks", "No offboarding tasks", "لا توجد مهام إنهاء"],
  ["noAuditEntries", "No audit entries", "لا توجد سجلات تدقيق"],
  ["manage", "Manage →", "إدارة →"],
  ["baseSalary", "Base Salary:", "الراتب الأساسي:"],
  ["salaryType", "Salary Type:", "نوع الراتب:"],
  ["paymentMethod", "Payment Method:", "طريقة الدفع:"],
  ["overtimeRate", "Overtime Rate:", "معدل العمل الإضافي:"],
  ["dailyRate", "Daily Rate:", "المعدل اليومي:"],
  ["hourlyRate", "Hourly Rate:", "المعدل بالساعة:"],
  ["inGeofence", "In geofence", "داخل الجيو فينس"],
  ["outsideGeofence", "Outside", "خارج"],
  ["paid", "Paid", "مدفوع"],
  ["unpaid", "Unpaid", "غير مدفوع"],
  ["noReason", "No reason", "بدون سبب"],
  ["scoreLabel", "Score:", "النتيجة:"],
  ["daysLabel", "days", "أيام"],
  ["usedLabel", "Used:", "مستخدم:"],
  ["pendingLabel", "Pending:", "قيد الانتظار:"],
  ["currencyLabel", "EGP", "ج.م"],
]);

// ═══════════════════════════════════════════════════════
// PAYROLL RUNS/[id]
// ═══════════════════════════════════════════════════════
addKeys("hrPayrollRuns", [
  ["runTitle", "Payroll Run -- {month} {year}", "دورة الرواتب -- {month} {year}"],
  ["backToRuns", "← Payroll Runs", "← دورات الرواتب"],
  ["generateLines", "Generate Lines", "إنشاء البنود"],
  ["recalculate", "Recalculate", "إعادة الحساب"],
  ["moveToReview", "Move to Review", "إرسال للمراجعة"],
  ["approveRun", "Approve", "موافقة"],
  ["lockRun", "Lock", "قفل"],
  ["cancelRun", "Cancel Run", "إلغاء الدورة"],
  ["addAdjustment", "Add Adjustment", "إضافة تعديل"],
  ["exportExcel", "Export Excel", "تصدير Excel"],
  ["rejectRun", "Reject", "رفض"],
  ["actionsCard", "Actions", "الإجراءات"],
  ["linesCard", "Payroll Lines ({count})", "بنود الرواتب ({count})"],
  ["adjustmentsCard", "Adjustments ({count})", "التعديلات ({count})"],
  ["employeesMetric", "Employees", "الموظفون"],
  ["baseSalaryMetric", "Base Salary", "الراتب الأساسي"],
  ["overtimeHoursMetric", "Overtime Hours", "ساعات العمل الإضافي"],
  ["additionsMetric", "Additions", "الإضافات"],
  ["deductionsMetric", "Deductions", "الخصومات"],
  ["netAmountMetric", "Net Amount", "صافي المبلغ"],
  ["tableEmployee", "Employee", "الموظف"],
  ["tableCode", "Code", "الكود"],
  ["tableBranch", "Branch", "الفرع"],
  ["tableDept", "Dept", "القسم"],
  ["tableSchd", "Schd", "الجدول"],
  ["tablePres", "Pres", "الحضور"],
  ["tableAbs", "Abs", "الغياب"],
  ["tableLeave", "Leave", "الإجازة"],
  ["tableOff", "Off", "عطلة"],
  ["tableHours", "Hours", "الساعات"],
  ["tableOtHrs", "OT Hrs", "ساعات إضافي"],
  ["tableLate", "Late", "التأخير"],
  ["tableBaseSalary", "Base Salary", "الراتب الأساسي"],
  ["tableAdditions", "Additions", "الإضافات"],
  ["tableDeductions", "Deductions", "الخصومات"],
  ["tableNet", "Net", "الصافي"],
  ["formEmployeeId", "Employee ID", "رقم الموظف"],
  ["formType", "Type", "النوع"],
  ["formAmount", "Amount (EGP)", "المبلغ (ج.م)"],
  ["formReason", "Reason", "السبب"],
  ["lockReady", "Payroll run is ready to lock.", "دورة الرواتب جاهزة للقفل."],
  ["resolveItems", "Resolve these items before locking payroll.", "حل هذه البنود قبل قفل الرواتب."],
  ["pendingAdjustments", "Pending adjustments:", "التعديلات المعلقة:"],
  ["pendingApprovalRequests", "Pending approval requests:", "طلبات الموافقة المعلقة:"],
  ["attendanceRequiringApproval", "Attendance requiring approval:", "الحضور المحتاج لموافقة:"],
  ["missingClockOut", "Missing clock-out / no-schedule:", "غياب تسجيل الخروج / لا جدول:"],
  ["pendingLeaveRequests", "Pending leave requests:", "طلبات الإجازة المعلقة:"],
  ["missingPayrollProfiles", "Missing payroll profiles:", "ملفات الرواتب المفقودة:"],
  ["taxNote", "Note: Tax and social insurance are not calculated in this MVP. All amounts are base calculations from attendance and payroll profiles.", "ملاحظة: الضرائب والتأمين الاجتماعي غير محسوبة في الإصدار الأولي. جميع المبالغ حسابات أساسية من الحضور وملفات الرواتب."],
  ["totals", "Totals", "الإجماليات"],
  ["noLines", "No payroll lines generated", "لم يتم إنشاء بنود رواتب"],
  ["noAdjustments", "No adjustments", "لا توجد تعديلات"],
  ["adjustmentBonus", "Bonus", "مكافأة"],
  ["adjustmentDeduction", "Deduction", "خصم"],
  ["adjustmentAllowance", "Allowance", "بدلة"],
  ["adjustmentPenalty", "Penalty", "جزاء"],
  ["adjustmentOT", "OT Adjustment", "تعديل العمل الإضافي"],
  ["adjustmentManual", "Manual Correction", "تصحيح يدوي"],
]);

// ═══════════════════════════════════════════════════════
// HR WARNINGS (list)
// ═══════════════════════════════════════════════════════
addKeys("hrWarnings", [
  ["listTitle", "Employee Warnings", "تحذيرات الموظفين"],
  ["featureGateTitle", "HR Module requires Starter plan or higher", "وحدة الموارد البشرية تتطلب باقة Starter أو أعلى"],
  ["upgradeMessage", "Upgrade to access HR features.", "قم بالترقية للوصول إلى ميزات الموارد البشرية."],
  ["totalWarnings", "Total Warnings", "إجمالي التحذيرات"],
  ["openCount", "Open", "مفتوح"],
  ["acknowledgedCount", "Acknowledged", "تم التأكيد"],
  ["resolvedCount", "Resolved", "تم الحل"],
  ["criticalSeverity", "Critical Severity", "حدة حرجة"],
  ["filters", "Filters", "التصفية"],
  ["allBranches", "All Branches", "جميع الفروع"],
  ["allSeverity", "All Severity", "جميع الحدات"],
  ["allStatus", "All Status", "جميع الحالات"],
  ["apply", "Apply", "تطبيق"],
  ["newWarning", "New Warning", "تحذير جديد"],
  ["tableEmployee", "Employee", "الموظف"],
  ["tableType", "Type", "النوع"],
  ["tableSeverity", "Severity", "الحدة"],
  ["tableDate", "Date", "التاريخ"],
  ["tableStatus", "Status", "الحالة"],
  ["tableActions", "Actions", "الإجراءات"],
  ["warningsCount", "Warnings ({count})", "التحذيرات ({count})"],
  ["noWarningsFound", "No warnings found", "لم يتم العثور على تحذيرات"],
  ["view", "View", "عرض"],
  ["openLabel", "{count} open", "{count} مفتوح"],
  ["acknowledgedLabel", "acknowledged", "تم التأكيد"],
  ["criticalLabel", "critical", "حرج"],
]);

// ═══════════════════════════════════════════════════════
// HR WARNINGS/[id]
// ═══════════════════════════════════════════════════════
addKeys("hrWarnings", [
  ["detailTitle", "{type} Warning", "تحذير {type}"],
  ["backToList", "← Warnings", "← التحذيرات"],
  ["branchLabel", "Branch", "الفرع"],
  ["departmentLabel", "Department", "القسم"],
  ["issuedBy", "Issued By", "أصدره"],
  ["createdLabel", "Created", "أنشئ في"],
  ["reasonCard", "Reason", "السبب"],
  ["actionTakenCard", "Action Taken", "الإجراء المتخذ"],
  ["notesCard", "Notes", "ملاحظات"],
  ["acknowledgmentCard", "Acknowledgment", "التأكيد"],
  ["actionsCard", "Actions", "الإجراءات"],
  ["acknowledgedByEmployee", "Acknowledged by employee", "تم التأكيد من الموظف"],
  ["onDate", "On {date}", "في {date}"],
  ["resolve", "Resolve", "حل"],
  ["cancelWarning", "Cancel Warning", "إلغاء التحذير"],
]);

// ═══════════════════════════════════════════════════════
// REQUESTS
// ═══════════════════════════════════════════════════════
addKeys("requests", [
  ["requestType", "Request type", "نوع الطلب"],
  ["forgotClockIn", "Forgot Clock In", "نسيان تسجيل الدخول"],
  ["forgotClockOut", "Forgot Clock Out", "نسيان تسجيل الخروج"],
  ["missingClockOut", "Missing Clock Out", "غياب تسجيل الخروج"],
  ["outsideGeofence", "Outside Geofence Approval", "موافقة خارج الجيو فينس"],
  ["overtimeApproval", "Overtime Approval", "موافقة العمل الإضافي"],
  ["attendanceCorrection", "Attendance Correction", "تصحيح الحضور"],
  ["leaveRequest", "Leave Request", "طلب إجازة"],
  ["permissionRequest", "Permission Request", "طلب إذن"],
  ["dateLabel", "Date *", "التاريخ *"],
  ["dateToLabel", "Date to (for leave range)", "التاريخ إلى (لنطاق الإجازة)"],
  ["requestedClockIn", "Requested clock-in time", "وقت تسجيل الدخول المطلوب"],
  ["requestedClockOut", "Requested clock-out time", "وقت تسجيل الخروج المطلوب"],
  ["fromLabel", "From", "من"],
  ["toLabel", "To", "إلى"],
  ["reasonLabel", "Reason *", "السبب *"],
  ["reasonPlaceholder", "Explain why this request is needed (min 5 chars)", "اشرح لماذا تحتاج هذا الطلب (5 أحرف على الأقل)"],
  ["submittedMessage", "Request submitted. Your manager will review it.", "تم إرسال الطلب. سيراجعه مديرك."],
  ["submitting", "Submitting...", "جاري الإرسال..."],
  ["submitRequest", "Submit request", "إرسال الطلب"],
]);

// ═══════════════════════════════════════════════════════
// KIOSK
// ═══════════════════════════════════════════════════════
addKeys("kiosk", [
  ["kioskMode", "Kiosk Mode", "وضع الكيوسك"],
  ["description", "Enter your employee code or PIN to clock in/out.", "أدخل كود موظفك أو PIN لتسجيل الدخول/الخروج."],
  ["branchLabel", "Branch", "الفرع"],
  ["selectBranch", "Select branch", "اختر الفرع"],
  ["employeeCode", "Employee code", "كود الموظف"],
  ["pinLabel", "PIN", "PIN"],
  ["codePlaceholder", "EMP001", "EMP001"],
  ["pinPlaceholder", "0000", "0000"],
  ["orDivider", "— or —", "— أو —"],
  ["findEmployee", "Find employee", "بحث عن موظف"],
  ["clockInBtn", "Clock In", "تسجيل الدخول"],
  ["clockOutBtn", "Clock Out", "تسجيل الخروج"],
  ["cancel", "Cancel / Look up another employee", "إلغاء / البحث عن موظف آخر"],
  ["clockedIn", "Clocked In", "تم تسجيل الدخول"],
  ["clockedOut", "Clocked Out", "تم تسجيل الخروج"],
  ["shiftLabel", "Shift:", "الوردية:"],
]);

// ═══════════════════════════════════════════════════════
// MY LEAVE
// ═══════════════════════════════════════════════════════
addKeys("myLeave", [
  ["newLeaveRequest", "New Leave Request", "طلب إجازة جديد"],
  ["pendingRequests", "Pending Requests", "الطلبات المعلقة"],
  ["leaveTypeLabel", "Leave type", "نوع الإجازة"],
  ["startDateLabel", "Start date", "تاريخ البداية"],
  ["endDateLabel", "End date", "تاريخ النهاية"],
  ["reasonLabel", "Reason", "السبب"],
  ["selectLeaveType", "Select leave type", "اختر نوع الإجازة"],
  ["reasonPlaceholder", "Optional: explain why you need leave", "اختياري: اشرح لماذا تحتاج إجازة"],
  ["submittedSuccess", "Leave request submitted successfully.", "تم إرسال طلب الإجازة بنجاح."],
  ["submittingLabel", "Submitting...", "جاري الإرسال..."],
  ["submitBtn", "Submit leave request", "إرسال طلب الإجازة"],
  ["pendingStatus", "PENDING", "قيد الانتظار"],
]);

// ═══════════════════════════════════════════════════════
// HR CONTRACTS
// ═══════════════════════════════════════════════════════
addKeys("hrContracts", [
  ["newContract", "New Contract", "عقد جديد"],
  ["backToContracts", "← Contracts", "← العقود"],
  ["contractDetails", "Contract Details", "تفاصيل العقد"],
  ["employeeIdLabel", "Employee ID *", "رقم الموظف *"],
  ["contractNumberLabel", "Contract Number *", "رقم العقد *"],
  ["contractTypeLabel", "Contract Type *", "نوع العقد *"],
  ["startDateLabel", "Start Date *", "تاريخ البداية *"],
  ["endDateLabel", "End Date", "تاريخ النهاية"],
  ["probationEndLabel", "Probation End Date", "تاريخ انتهاء فترة التجربة"],
  ["salaryReferenceLabel", "Salary Reference", "مرجع الراتب"],
  ["notesLabel", "Notes", "ملاحظات"],
  ["fullTime", "Full Time", "دوام كامل"],
  ["partTime", "Part Time", "دوام جزئي"],
  ["temporary", "Temporary", "مؤقت"],
  ["dailyWorker", "Daily Worker", "عميل يومي"],
  ["contractor", "Contractor", "مقاول"],
  ["internship", "Internship", "تدريب"],
  ["employeeIdPlaceholder", "Employee ID", "رقم الموظف"],
  ["contractNumberPlaceholder", "e.g. CT-2026-001", "مثلاً CT-2026-001"],
  ["optionalLabel", "Optional", "اختياري"],
  ["notesPlaceholder", "Optional notes", "ملاحظات اختيارية"],
  ["creating", "Creating...", "جاري الإنشاء..."],
  ["createContract", "Create Contract", "إنشاء العقد"],
  ["featureGateTitle", "HR Module requires Growth plan or higher", "وحدة الموارد البشرية تتطلب باقة Growth أو أعلى"],
  ["contractTypeLabelDetail", "Contract Type", "نوع العقد"],
  ["branchLabel", "Branch", "الفرع"],
  ["startDateLabelDetail", "Start Date", "تاريخ البداية"],
  ["endDateLabelDetail", "End Date", "تاريخ النهاية"],
  ["probationEndLabelDetail", "Probation End", "نهاية فترة التجربة"],
  ["salaryRefLabel", "Salary Reference", "مرجع الراتب"],
  ["openEnded", "Open-ended", "غير محدد المدة"],
  ["notesCard", "Notes", "ملاحظات"],
  ["actionsCard", "Actions", "الإجراءات"],
  ["expiringWarning", "This contract expires on {date} — consider renewing.", "ينتهي هذا العقد في {date} — فكر في التجديد."],
  ["activate", "Activate", "تفعيل"],
  ["renew", "Renew", "تجديد"],
  ["terminate", "Terminate", "إنهاء"],
  ["newEndDate", "New end date", "تاريخ نهاية جديد"],
]);

// ═══════════════════════════════════════════════════════
// HR ONBOARDING
// ═══════════════════════════════════════════════════════
addKeys("hrOnboarding", [
  ["addTask", "Add Task", "إضافة مهمة"],
  ["taskTitle", "Task title", "عنوان المهمة"],
  ["taskDescription", "Description (optional)", "الوصف (اختياري)"],
  ["createDefaultChecklist", "Create Default Checklist", "إنشاء قائمة مهام افتراضية"],
  ["progress", "Progress", "التقدم"],
  ["dueLabel", "Due:", "الموعد:"],
  ["complete", "Complete", "إكمال"],
  ["cancel", "Cancel", "إلغاء"],
]);

// ═══════════════════════════════════════════════════════
// HR OFFBOARDING
// ═══════════════════════════════════════════════════════
addKeys("hrOffboarding", [
  ["addTask", "Add Task", "إضافة مهمة"],
  ["taskTitle", "Task title", "عنوان المهمة"],
  ["taskDescription", "Description (optional)", "الوصف (اختياري)"],
  ["disableUserAccess", "Disable User Access", "تعطيل وصول المستخدم"],
  ["finalizeOffboarding", "Finalize Offboarding", "إنهاء الإنهاء"],
  ["disableAccess", "Disable Access", "تعطيل الوصول"],
  ["finalize", "Finalize", "إنهاء"],
  ["completeAllTasks", "Complete or cancel all tasks before finalizing.", "أكمل أو ألغِ جميع المهام قبل الإنهاء."],
  ["allTasksCompleted", "All tasks completed. Finalizing will set the employee status to LEFT and disable their account.", "تم إكمال جميع المهام. الإنهاء سيغير حالة الموظف إلى LEFT ويعطل حسابه."],
]);

// ═══════════════════════════════════════════════════════
// HR DOCUMENTS
// ═══════════════════════════════════════════════════════
addKeys("hrDocuments", [
  ["featureGateTitle", "Document Management requires Starter plan or higher", "إدارة المستندات تتطلب باقة Starter أو أعلى"],
  ["upgradeMessage", "Upgrade to access document management.", "قم بالترقية للوصول لإدارة المستندات."],
  ["validDocuments", "Valid documents", "مستندات سارية"],
  ["expiringIn30", "Expiring in 30 days", "تنتهي خلال 30 يوم"],
  ["missingDocuments", "Missing documents", "مستندات مفقودة"],
  ["expiringSoon", "Expiring soon", "تنتهي قريباً"],
]);

// ═══════════════════════════════════════════════════════
// TEAM COACH (additional)
// ═══════════════════════════════════════════════════════
addKeys("teamCoach", [
  ["needSupport", "Need support", "يحتاج دعم"],
  ["improving", "Improving", "يتحسن"],
  ["topConsistency", "Top consistency", "أعلى اتساق"],
  ["noOneNeedsAttention", "No one needs attention right now", "لا أحد يحتاج اهتمام الآن"],
  ["teamOnTrack", "Your team is on track this period.", "فريقك على المسار الصحيح في هذه الفترة."],
]);

// ═══════════════════════════════════════════════════════
// AUDIT (additional)
// ═══════════════════════════════════════════════════════
addKeys("audit", [
  ["subtitle", "All important actions in your company. Latest 200 entries.", "جميع الإجراءات المهمة في شركتك. آخر 200 سجل."],
  ["all", "ALL", "الكل"],
]);

// ═══════════════════════════════════════════════════════
// DEPARTMENTS
// ═══════════════════════════════════════════════════════
addKeys("departments", [
  ["addDepartmentBtn", "Add department", "إضافة قسم"],
  ["nameLabel", "Name", "الاسم"],
  ["kitchenPlaceholder", "Kitchen", "المطبخ"],
  ["addBtn", "Add", "إضافة"],
  ["noDepartments", "No departments", "لا توجد أقسام"],
  ["employeesLabel", "employees", "موظفون"],
]);

// ═══════════════════════════════════════════════════════
// BRANCHES FORM
// ═══════════════════════════════════════════════════════
addKeys("branches", [
  ["nameLabel", "Name *", "الاسم *"],
  ["codeLabel", "Code *", "الكود *"],
  ["branchAdded", "Branch added.", "تمت إضافة الفرع."],
  ["saving", "Saving...", "جاري الحفظ..."],
  ["addBranchBtn", "Add branch", "إضافة فرع"],
]);

// ═══════════════════════════════════════════════════════
// POLICIES FORM
// ═══════════════════════════════════════════════════════
addKeys("policies", [
  ["policyAdded", "Policy added.", "تمت إضافة السياسة."],
  ["saving", "Saving...", "جاري الحفظ..."],
  ["addPolicyBtn", "Add policy", "إضافة سياسة"],
]);

// ═══════════════════════════════════════════════════════
// USERS FORM
// ═══════════════════════════════════════════════════════
addKeys("users", [
  ["userInvited", "User invited. Temporary password:", "تمت دعوة المستخدم. كلمة المرور المؤقتة:"],
  ["sendToUser", "Send this to the user. They will be forced to change it on first login.", "أرسلها للمستخدم. سيُجبر على تغييرها عند تسجيل الدخول الأول."],
  ["inviting", "Inviting...", "جاري الدعوة..."],
  ["inviteUser", "Invite user", "دعوة مستخدم"],
]);

// ═══════════════════════════════════════════════════════
// HR ASSETS ASSIGNMENTS
// ═══════════════════════════════════════════════════════
addKeys("hrAssets", [
  ["newAssignment", "New Assignment", "مهمة جديدة"],
  ["totalSummary", "Total", "الإجمالي"],
  ["activeSummary", "Active", "نشط"],
  ["returnedSummary", "Returned", "مرتجع"],
  ["lostSummary", "Lost", "مفقود"],
  ["damagedSummary", "Damaged", "تالف"],
  ["allFilter", "All", "الكل"],
  ["noAssignments", "No assignments", "لا توجد مهام"],
  ["noAssignmentsDesc", "Assign assets to employees to track them", "خصص أصولاً للموظفين لتتبعها"],
]);

// ═══════════════════════════════════════════════════════
// HR PAYROLL PROFILES
// ═══════════════════════════════════════════════════════
addKeys("hrPayrollProfiles", [
  ["newProfile", "New Profile", "ملف جديد"],
  ["filtersLabel", "Filters", "التصفية"],
  ["allBranches", "All Branches", "جميع الفروع"],
  ["allDepartments", "All Departments", "جميع الأقسام"],
  ["allTypes", "All Types", "جميع الأنواع"],
  ["apply", "Apply", "تطبيق"],
  ["noProfilesYet", "No payroll profiles", "لا توجد ملفات رواتب"],
  ["noProfilesDesc", "Create your first payroll profile to get started", "أنشئ ملف رواتبك الأول للبدء"],
]);

// ═══════════════════════════════════════════════════════
// COACH LIBRARY
// ═══════════════════════════════════════════════════════
addKeys("coach", [
  ["addCustomTip", "Add custom tip", "إضافة نصيحة مخصصة"],
  ["customTips", "Custom tips", "نصائح مخصصة"],
  ["systemDefaultTips", "System default tips", "نصائح النظام الافتراضية"],
  ["noSystemTips", "No system tips", "لا توجد نصائح نظام"],
  ["deactivate", "Deactivate", "تعطيل"],
  ["activate", "Activate", "تفعيل"],
  ["inactive", "inactive", "غير نشط"],
  ["noCustomTipsYet", "No custom tips yet. Use the form above to add one.", "لا توجد نصائح مخصصة بعد. استخدم النموذج أعلاه لإضافة واحدة."],
]);

// ═══════════════════════════════════════════════════════
// SUPPORT
// ═══════════════════════════════════════════════════════
addKeys("support", [
  ["categoryGeneral", "General", "عام"],
  ["categoryBilling", "Billing", "الفواتير"],
  ["categoryTechnical", "Technical", "تقني"],
  ["categoryReports", "Reports", "التقارير"],
  ["categoryAttendance", "Attendance", "الحضور"],
  ["categoryOther", "Other", "أخرى"],
  ["priorityLow", "Low", "منخفض"],
  ["priorityNormal", "Normal", "عادي"],
  ["priorityHigh", "High", "مرتفع"],
  ["priorityUrgent", "Urgent", "عاجل"],
]);

// Write
fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + "\n");
fs.writeFileSync(arPath, JSON.stringify(ar, null, 2) + "\n");

console.log(`EN keys written. Total namespaces: ${Object.keys(en).length}`);
console.log(`AR keys written. Total namespaces: ${Object.keys(ar).length}`);
console.log("Done!");
