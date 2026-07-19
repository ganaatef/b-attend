#!/usr/bin/env tsx
/**
 * Add ALL remaining missing translation keys for hardcoded strings.
 * Run: npx tsx scripts/add-remaining-keys.ts
 */
import fs from "fs";

const en: Record<string, any> = JSON.parse(fs.readFileSync("messages/en.json", "utf-8"));
const ar: Record<string, any> = JSON.parse(fs.readFileSync("messages/ar.json", "utf-8"));

function addKeys(ns: string, entries: [string, string, string][]) {
  if (!en[ns]) en[ns] = {};
  if (!ar[ns]) ar[ns] = {};
  for (const [key, enVal, arVal] of entries) {
    if (!(key in en[ns])) en[ns][key] = enVal;
    if (!(key in ar[ns])) ar[ns][key] = arVal;
  }
}

// ═══════════════════════════════════════════════════════
// PAYROLL RUNS LIST
// ═══════════════════════════════════════════════════════
addKeys("hrPayrollRuns", [
  ["totalRuns", "Total runs", "إجمالي الدورات"],
  ["newRun", "New Run", "دورة جديدة"],
  ["filterLabel", "Filter:", "التصفية:"],
  ["yearLabel", "Year:", "السنة:"],
  ["noPayrollRuns", "No payroll runs", "لا توجد دورات رواتب"],
  ["createFirst", "Create your first payroll run to get started.", "أنشئ أول دورة رواتب للبدء."],
  ["latest", "LATEST", "الأحدث"],
  ["lineCount", "{count} line", "{count} بند"],
  ["lineCountPlural", "{count} lines", "{count} بنود"],
  ["approvedPrefix", "Approved", "تمت الموافقة"],
  ["lockedPrefix", "Locked", "مقفل"],
  ["featureGateTitle", "Payroll requires Pro plan or higher", "الرواتب تتطلب باقة Pro أو أعلى"],
  ["upgradeMessage", "Upgrade to access payroll.", "قم بالترقية للوصول للرواتب."],
  ["january", "January", "يناير"],
  ["february", "February", "فبراير"],
  ["march", "March", "مارس"],
  ["april", "April", "أبريل"],
  ["may", "May", "مايو"],
  ["june", "June", "يونيو"],
  ["july", "July", "يوليو"],
  ["august", "August", "أغسطس"],
  ["september", "September", "سبتمبر"],
  ["october", "October", "أكتوبر"],
  ["november", "November", "نوفمبر"],
  ["december", "December", "ديسمبر"],
]);

// ═══════════════════════════════════════════════════════
// NEW PAYROLL RUN FORM
// ═══════════════════════════════════════════════════════
addKeys("hrPayrollRuns", [
  ["newPayrollRun", "New Payroll Run", "دورة رواتب جديدة"],
  ["runDetails", "Run Details", "تفاصيل الدورة"],
  ["linesInfo", "Lines will be generated from AttendanceDay data. Employees without active payroll profiles will appear in warnings.", "سيتم إنشاء البنود من بيانات الحضور. الموظفون بدون ملفات رواتب نشطة سيظهرون في التحذيرات."],
  ["taxNoteShort", "Note: Tax and social insurance are not calculated in this MVP.", "ملاحظة: الضرائب والتأمين الاجتماعي غير محسوبة في الإصدار الأولي."],
  ["optionalNotes", "Optional notes about this payroll run", "ملاحظات اختيارية عن دورة الرواتب هذه"],
  ["creating", "Creating...", "جاري الإنشاء..."],
  ["createRun", "Create Payroll Run", "إنشاء دورة الرواتب"],
  ["createdWarnings", "Created with warnings:\n{warnings}", "تم الإنشاء مع تحذيرات:\n{warnings}"],
]);

// ═══════════════════════════════════════════════════════
// HR ONBOARDING LIST
// ═══════════════════════════════════════════════════════
addKeys("hrOnboarding", [
  ["backToHR", "← HR Dashboard", "← لوحة الموارد البشرية"],
  ["onboardingTitle", "Onboarding", "التأهيل"],
  ["employeesWithTasks", "employees with onboarding tasks", "موظفون بهوات تأهيل"],
  ["employeesInOnboarding", "Employees in onboarding", "موظفون في التأهيل"],
  ["tasksPending", "Tasks pending", "مهام معلقة"],
  ["tasksCompleted", "Tasks completed", "مهام مكتملة"],
  ["tasksOverdue", "Tasks overdue", "مهام متأخرة"],
  ["createDefaultChecklist", "Create Default Checklist", "إنشاء قائمة مهام افتراضية"],
  ["employeeLabel", "Employee", "الموظف"],
  ["selectEmployee", "Select employee...", "اختر موظف..."],
  ["createBtn", "Create", "إنشاء"],
  ["employeesCard", "Employees", "الموظفون"],
  ["noEmployeesOnboarding", "No employees in onboarding", "لا يوجد موظفون في التأهيل"],
  ["tasksLabel", "tasks", "مهام"],
]);

// ═══════════════════════════════════════════════════════
// HR OFFBOARDING LIST
// ═══════════════════════════════════════════════════════
addKeys("hrOffboarding", [
  ["backToHR", "← HR Dashboard", "← لوحة الموارد البشرية"],
  ["offboardingTitle", "Offboarding", "الإنهاء"],
  ["employeesInOffboarding", "employees in offboarding", "موظفون في الإنهاء"],
  ["employeesInOffboardingCount", "Employees in offboarding", "موظفون في الإنهاء"],
  ["tasksPending", "Tasks pending", "مهام معلقة"],
  ["tasksCompleted", "Tasks completed", "مهام مكتملة"],
  ["employeesFinalized", "Employees finalized", "موظفون تم إنهاؤهم"],
  ["startOffboarding", "Start Offboarding", "بدء الإنهاء"],
  ["employeeLabel", "Employee", "الموظف"],
  ["lastWorkingDay", "Last working day", "آخر يوم عمل"],
  ["selectEmployee", "Select employee...", "اختر موظف..."],
  ["startBtn", "Start", "بدء"],
  ["employeesCard", "Employees", "الموظفون"],
  ["noEmployeesOffboarding", "No employees in offboarding", "لا يوجد موظفون في الإنهاء"],
  ["tasksLabel", "tasks", "مهام"],
  ["disableAccessNote", "This will immediately disable the employee's portal and system access.", "سيؤدي ذلك فوراً لتعطيل وصول الموظف للنظام والبوابة."],
]);

// ═══════════════════════════════════════════════════════
// HR LEAVES
// ═══════════════════════════════════════════════════════
addKeys("hrLeaves", [
  ["featureGateTitle", "Leave Management requires Growth plan or higher", "إدارة الإجازات تتطلب باقة Growth أو أعلى"],
  ["upgradeMessage", "Upgrade to access leave features.", "قم بالترقية للوصول لميزات الإجازات."],
  ["backToLeave", "← Leave Management", "← إدارة الإجازات"],
  ["leaveRequest", "Leave Request", "طلب إجازة"],
  ["leaveType", "Leave Type", "نوع الإجازة"],
  ["paid", "Paid", "مدفوع"],
  ["yes", "Yes", "نعم"],
  ["no", "No", "لا"],
  ["startDate", "Start Date", "تاريخ البداية"],
  ["endDate", "End Date", "تاريخ النهاية"],
  ["days", "Days", "الأيام"],
  ["branch", "Branch", "الفرع"],
  ["reason", "Reason", "السبب"],
  ["managerNotes", "Manager Notes", "ملاحظات المدير"],
  ["actions", "Actions", "الإجراءات"],
  ["approve", "Approve", "موافقة"],
  ["reject", "Reject", "رفض"],
  ["cancelRequest", "Cancel Request", "إلغاء الطلب"],
  ["newLeaveRequest", "New Leave Request", "طلب إجازة جديد"],
  ["leaveDetails", "Leave Details", "تفاصيل الإجازة"],
  ["employeeId", "Employee ID *", "رقم الموظف *"],
  ["employeeIdPlaceholder", "Employee ID", "رقم الموظف"],
  ["leaveTypeId", "Leave Type *", "نوع الإجازة *"],
  ["leaveTypePlaceholder", "Leave Type ID", "رقم نوع الإجازة"],
  ["startDateLabel", "Start Date *", "تاريخ البداية *"],
  ["endDateLabel", "End Date *", "تاريخ النهاية *"],
  ["reasonLabel", "Reason", "السبب"],
  ["reasonPlaceholder", "Optional reason", "سبب اختياري"],
  ["creating", "Creating...", "جاري الإنشاء..."],
  ["submitRequest", "Submit Request", "إرسال الطلب"],
  ["permissionRequired", "Permission Required", "الإذن مطلوب"],
  ["noPermission", "You do not have permission to create leave requests.", "ليس لديك إذن بإنشاء طلبات إجازة."],
]);

// ═══════════════════════════════════════════════════════
// HR ASSETS DETAIL
// ═══════════════════════════════════════════════════════
addKeys("hrAssets", [
  ["backToAssets", "← Assets", "← الأصول"],
  ["noCode", "No code", "بدون كود"],
  ["statusLabel", "Status", "الحالة"],
  ["typeLabel", "Type", "النوع"],
  ["purchaseDate", "Purchase Date", "تاريخ الشراء"],
  ["notesCard", "Notes", "ملاحظات"],
  ["assignAsset", "Assign Asset", "تخصيص الأصل"],
  ["currentAssignment", "Current Assignment", "التخصيص الحالي"],
  ["assignedPrefix", "Assigned", "مخصص"],
  ["conditionLabel", "Condition:", "الحالة:"],
  ["assignedBadge", "ASSIGNED", "مخصص"],
  ["returnBtn", "Return", "إرجاع"],
  ["markLost", "Mark Lost", "تحديد كمفقود"],
  ["markDamaged", "Mark Damaged", "تحديد كتالف"],
  ["retireAsset", "Retire Asset", "إيقاف الأصل"],
  ["assignmentHistory", "Assignment History ({count})", "سجل التخصيص ({count})"],
  ["noAssignmentHistory", "No assignment history", "لا يوجد سجل تخصيص"],
  ["outLabel", "Out:", "خروج:"],
  ["inLabel", "In:", "دخول:"],
  ["assetAssigned", "Asset assigned successfully.", "تم تخصيص الأصل بنجاح."],
  ["conditionOnAssign", "Condition on Assign", "الحالة عند التخصيص"],
  ["conditionPlaceholder", "e.g. New, Good", "مثلاً جديد، جيد"],
  ["optionalNotes", "Optional notes", "ملاحظات اختيارية"],
  ["assigning", "Assigning...", "جاري التخصيص..."],
  ["assignAssetBtn", "Assign Asset", "تخصيص الأصل"],
  ["assetDetails", "Asset Details", "تفاصيل الأصل"],
  ["nameRequired", "Name *", "الاسم *"],
  ["namePlaceholder", "e.g. Chef Uniform", "مثلاً يونيفورم شيف"],
  ["typeRequired", "Type *", "النوع *"],
  ["uniform", "Uniform", "يونيفورم"],
  ["device", "Device", "جهاز"],
  ["card", "Card", "بطاقة"],
  ["key", "Key", "مفتاح"],
  ["tools", "Tools", "أدوات"],
  ["codeLabel", "Code", "الكود"],
  ["codePlaceholder", "e.g. AST-001", "مثلاً AST-001"],
  ["newAssignment", "New Asset Assignment", "تخصيص أصل جديد"],
  ["assignmentDetails", "Assignment Details", "تفاصيل التخصيص"],
]);

// ═══════════════════════════════════════════════════════
// HR DOCUMENTS DETAIL + NEW
// ═══════════════════════════════════════════════════════
addKeys("hrDocuments", [
  ["backToDocuments", "← Documents", "← المستندات"],
  ["expiresSoonWarning", "This document expires on {date} — renew soon.", "ينتهي هذا المستند في {date} — جدد قريباً."],
  ["documentNumber", "Document Number", "رقم المستند"],
  ["branchLabel", "Branch", "الفرع"],
  ["issueDate", "Issue Date", "تاريخ الإصدار"],
  ["expiryDate", "Expiry Date", "تاريخ الانتهاء"],
  ["expiringSoonBadge", "Expiring soon", "ينتهي قريباً"],
  ["notesCard", "Notes", "ملاحظات"],
  ["actionsCard", "Actions", "الإجراءات"],
  ["approveValid", "Approve (Valid)", "موافقة (ساري)"],
  ["markExpired", "Mark Expired", "تحديد كمنتهي"],
  ["markMissing", "Mark Missing", "تحديد كمفقود"],
  ["addDocument", "Add Document", "إضافة مستند"],
  ["documentDetails", "Document Details", "تفاصيل المستند"],
  ["employeeIdLabel", "Employee ID *", "رقم الموظف *"],
  ["employeeIdPlaceholder", "Employee ID", "رقم الموظف"],
  ["documentTypeLabel", "Document Type *", "نوع المستند *"],
  ["nationalId", "National ID", "رقم الهوية"],
  ["passport", "Passport", "جواز السفر"],
  ["workPermit", "Work Permit", "تصريح العمل"],
  ["healthCertificate", "Health Certificate", "شهادة صحية"],
  ["foodSafety", "Food Safety Certificate", "شهادة سلامة غذائية"],
  ["contract", "Contract", "عقد"],
  ["insurance", "Insurance Form", "استمارة التأمين"],
  ["medical", "Medical Certificate", "شهادة طبية"],
  ["docNumberLabel", "Document Number", "رقم المستند"],
  ["optionalPlaceholder", "Optional", "اختياري"],
  ["adding", "Adding...", "جاري الإضافة..."],
  ["addDocumentBtn", "Add Document", "إضافة مستند"],
]);

// ═══════════════════════════════════════════════════════
// HR CONTRACTS LIST
// ═══════════════════════════════════════════════════════
addKeys("hrContracts", [
  ["contractsTitle", "Contracts", "العقود"],
  ["totalLabel", "total", "إجمالي"],
  ["activeLabel", "active", "نشط"],
  ["expiringWithin30", "expiring within 30 days", "تنتهي خلال 30 يوم"],
  ["exportExcel", "Export Excel", "تصدير Excel"],
  ["newContractBtn", "New Contract", "عقد جديد"],
  ["activeContracts", "Active contracts", "عقود نشطة"],
  ["expiringIn30", "Expiring in 30 days", "تنتهي خلال 30 يوم"],
  ["expiredLabel", "Expired", "منتهي"],
  ["noContracts", "No contracts", "لا توجد عقود"],
  ["createFirst", "Create your first employee contract", "أنشئ أول عقد موظف"],
  ["openLabel", "Open", "مفتوح"],
  ["expiringSoonBadge", "Expiring soon", "ينتهي قريباً"],
  ["featureGateTitle", "HR Module requires Growth plan or higher", "وحدة الموارد البشرية تتطلب باقة Growth أو أعلى"],
  ["upgradeMessage", "Upgrade to access HR features.", "قم بالترقية للوصول لميزات الموارد البشرية."],
]);

// ═══════════════════════════════════════════════════════
// EMPLOYEE FORM
// ═══════════════════════════════════════════════════════
addKeys("employees", [
  ["codeRequired", "Code *", "الكود *"],
  ["fullNameRequired", "Full name *", "الاسم الكامل *"],
  ["phoneLabel", "Phone", "الهاتف"],
  ["emailLabel", "Email", "البريد الإلكتروني"],
  ["jobTitleLabel", "Job title", "المسمى الوظيفي"],
  ["jobTitlePlaceholder", "Waiter", "جرسون"],
  ["branchRequired", "Branch *", "الفرع *"],
  ["selectPlaceholder", "Select", "اختر"],
  ["departmentLabel", "Department", "القسم"],
  ["employmentTypeLabel", "Employment type", "نوع التوظيف"],
  ["fullTime", "Full-time", "دوام كامل"],
  ["partTime", "Part-time", "دوام جزئي"],
  ["dailyWorker", "Daily worker", "عميل يومي"],
  ["temporary", "Temporary", "مؤقت"],
  ["contractor", "Contractor", "مقاول"],
  ["defaultShiftPolicy", "Default shift policy", "سياسة الوردية الافتراضية"],
  ["pinLabel", "PIN", "PIN"],
  ["employeeAdded", "Employee added.", "تمت إضافة الموظف."],
  ["saving", "Saving...", "جاري الحفظ..."],
  ["addEmployeeBtn", "Add employee", "إضافة موظف"],
  ["newEmployee", "New employee", "موظف جديد"],
  ["employeeDetails", "Employee details", "تفاصيل الموظف"],
]);

// ═══════════════════════════════════════════════════════
// SCHEDULE FORM
// ═══════════════════════════════════════════════════════
addKeys("schedules", [
  ["employeeRequired", "Employee *", "الموظف *"],
  ["branchRequired", "Branch *", "الفرع *"],
  ["dateRequired", "Date *", "التاريخ *"],
  ["policyRequired", "Policy *", "السياسة *"],
  ["customTimes", "Custom times", "أوقات مخصصة"],
  ["usePolicyTimes", "Use policy times", "استخدام أوقات السياسة"],
  ["durationLabel", "Duration:", "المدة:"],
  ["overnightShift", "Overnight shift", "وردية ليلية"],
  ["plannedStart", "Planned Start", "البداية المخططة"],
  ["plannedEnd", "Planned End", "النهاية المخططة"],
  ["scheduleAdded", "Schedule added.", "تمت إضافة الجدول."],
  ["addScheduleBtn", "Add schedule", "إضافة جدول"],
  ["weekendDaysLabel", "Weekend days (comma-separated)", "أيام عطلة نهاية الأسبوع (مفصولة بفواصل)"],
  ["selectAll", "Select all", "تحديد الكل"],
  ["noEmployeesInBranch", "No employees in this branch", "لا يوجد موظفون في هذا الفرع"],
  ["selectBranchFirst", "Select a branch first", "اختر الفرع أولاً"],
  ["createdSchedules", "Created {count} schedules. Skipped {skipped} duplicates.", "تم إنشاء {count} جدول. تم تخطي {skipped} مكرر."],
  ["generating", "Generating...", "جاري الإنشاء..."],
  ["generateSchedulesBtn", "Generate schedules", "إنشاء الجداول"],
  ["bulkDescription", "Generate schedules across a date range for multiple employees. Weekends are skipped by default. Duplicate employee/date schedules are skipped.", "إنشاء جداول لأكثر من موظف في نطاق تاريخ. يتم تخطي weekends افتراضياً. الجداول المكررة يتم تخطيها."],
  ["generateCard", "Generate", "إنشاء"],
]);

// ═══════════════════════════════════════════════════════
// WARNINGS FORM
// ═══════════════════════════════════════════════════════
addKeys("hrWarnings", [
  ["creating", "Creating...", "جاري الإنشاء..."],
  ["createWarning", "Create Warning", "إنشاء تحذير"],
  ["warningDetails", "Warning Details", "تفاصيل التحذير"],
  ["createdSuccess", "Warning created successfully.", "تم إنشاء التحذير بنجاح."],
  ["employeeRequired", "Employee *", "الموظف *"],
  ["selectEmployee", "Select employee", "اختر موظف"],
  ["noBranch", "No branch", "بدون فرع"],
  ["typeRequired", "Type *", "النوع *"],
  ["selectType", "Select type", "اختر النوع"],
  ["severityRequired", "Severity *", "الحدة *"],
  ["selectSeverity", "Select severity", "اختر الحدة"],
  ["reasonRequired", "Reason *", "السبب *"],
  ["reasonPlaceholder", "Describe the reason for this warning", "اشرح سبب هذا التحذير"],
  ["actionTakenLabel", "Action Taken", "الإجراء المتخذ"],
  ["optionalPlaceholder", "Optional", "اختياري"],
  ["notesLabel", "Notes", "ملاحظات"],
]);

// ═══════════════════════════════════════════════════════
// PAYROLL PROFILES DETAIL + FORMS
// ═══════════════════════════════════════════════════════
addKeys("hrPayrollProfiles", [
  ["backToProfiles", "← Payroll Profiles", "← ملفات الرواتب"],
  ["payrollProfile", "Payroll Profile", "ملف الرواتب"],
  ["activeBadge", "Active", "نشط"],
  ["inactiveBadge", "Inactive", "غير نشط"],
  ["employeeLabel", "Employee", "الموظف"],
  ["branchLabel", "Branch", "الفرع"],
  ["departmentLabel", "Department", "القسم"],
  ["salaryTypeLabel", "Salary Type", "نوع الراتب"],
  ["baseSalaryLabel", "Base Salary", "الراتب الأساسي"],
  ["paymentMethodLabel", "Payment Method", "طريقة الدفع"],
  ["paymentDetails", "Payment Details", "تفاصيل الدفع"],
  ["bankNameLabel", "Bank Name", "اسم البنك"],
  ["bankAccountLabel", "Bank Account", "رقم الحساب"],
  ["walletNumberLabel", "Wallet Number", "رقم المحفظة"],
  ["dailyRateLabel", "Daily Rate", "المعدل اليومي"],
  ["hourlyRateLabel", "Hourly Rate", "المعدل بالساعة"],
  ["overtimeMultiplier", "Overtime Multiplier", "معامل العمل الإضافي"],
  ["deductionRules", "Deduction Rules", "قواعد الخصم"],
  ["lateDeductionRule", "Late Deduction Rule", "قاعدة خصم التأخير"],
  ["absenceDeductionRule", "Absence Deduction Rule", "قاعدة خصم الغياب"],
  ["createdLabel", "Created", "أنشئ في"],
  ["linksCard", "Links", "روابط"],
  ["employeeProfile", "Employee Profile", "ملف الموظف"],
  ["editProfile", "Edit Profile", "تعديل الملف"],
  ["deactivateBtn", "Deactivate", "تعطيل"],
  ["payrollDetails", "Payroll Details", "تفاصيل الرواتب"],
  ["employeeRequired", "Employee *", "الموظف *"],
  ["selectEmployee", "Select employee", "اختر موظف"],
  ["baseSalaryRequired", "Base Salary *", "الراتب الأساسي *"],
  ["salaryPlaceholder", "e.g. 10000", "مثلاً 10000"],
  ["salaryTypeRequired", "Salary Type *", "نوع الراتب *"],
  ["monthly", "Monthly", "شهري"],
  ["daily", "Daily", "يومي"],
  ["hourly", "Hourly", "بالساعة"],
  ["currencyLabel", "Currency", "العملة"],
  ["bankTransfer", "Bank Transfer", "تحويل بنكي"],
  ["cash", "Cash", "نقدي"],
  ["mobileWallet", "Mobile Wallet", "محفولة إلكترونية"],
  ["cheque", "Cheque", "شيك"],
  ["optionalPlaceholder", "Optional", "اختياري"],
  ["overtimeRateMultiplier", "Overtime Rate Multiplier", "معامل معدل العمل الإضافي"],
  ["lateDeductionPlaceholder", "e.g. 50 per occurrence", "مثلاً 50 لكل مرة"],
  ["absenceDeductionPlaceholder", "e.g. Daily salary / 22 per day", "مثلاً الراتب اليومي / 22 لكل يوم"],
  ["creating", "Creating...", "جاري الإنشاء..."],
  ["createProfileBtn", "Create Profile", "إنشاء الملف"],
  ["saving", "Saving...", "جاري الحفظ..."],
  ["saveChanges", "Save Changes", "حفظ التغييرات"],
]);

// ═══════════════════════════════════════════════════════
// APPROVALS DETAIL
// ═══════════════════════════════════════════════════════
addKeys("approvals", [
  ["backToApprovals", "← Approvals", "← الموافقات"],
  ["forLabel", "For:", "لـ:"],
  ["requestDetails", "Request details", "تفاصيل الطلب"],
  ["employeeLabel", "Employee:", "الموظف:"],
  ["branchLabel", "Branch:", "الفرع:"],
  ["reasonLabel", "Reason:", "السبب:"],
  ["requestedLabel", "Requested:", "المطلوب:"],
  ["requestedByLabel", "Requested by:", "طلبه:"],
  ["createdLabel", "Created:", "أنشئ في:"],
  ["managerNotesLabel", "Manager notes:", "ملاحظات المدير:"],
  ["punchesOnDate", "Punches on this date", "بصمات هذا التاريخ"],
  ["noPunches", "No punches", "لا توجد بصمات"],
  ["inLabel", "in", "دخول"],
  ["outLabel", "out", "خروج"],
  ["decisionCard", "Decision", "القرار"],
  ["notesOptional", "Notes (optional)", "ملاحظات (اختياري)"],
  ["notesPlaceholder", "Notes visible to the employee...", "ملاحظات مرئية للموظف..."],
  ["decisionRecorded", "Decision recorded.", "تم تسجيل القرار."],
]);

// ═══════════════════════════════════════════════════════
// BRANCHES DETAIL
// ═══════════════════════════════════════════════════════
addKeys("branches", [
  ["geofenceRadius", "Geofence radius", "نصف قطر الجيو فينس"],
  ["employeesLabel", "Employees", "الموظفون"],
  ["scheduledToday", "Scheduled today", "مجدولون اليوم"],
  ["employeesAtBranch", "Employees at this branch", "الموظفون في هذا الفرع"],
  ["noEmployees", "No employees", "لا يوجد موظفون"],
]);

// ═══════════════════════════════════════════════════════
// SUPPORT DETAIL
// ═══════════════════════════════════════════════════════
addKeys("support", [
  ["backToSupport", "← Support", "← الدعم"],
  ["uncategorized", "Uncategorized", "غير مصنف"],
  ["priorityLabel", "priority", "أولوية"],
  ["conversationCard", "Conversation", "المحادثة"],
  ["replyCard", "Reply", "رد"],
  ["yourReply", "Your reply", " ردك"],
  ["replyPlaceholder", "Type your reply...", "اكتب ردك..."],
  ["replySent", "Reply sent.", "تم إرسال الرد."],
  ["sending", "Sending...", "جاري الإرسال..."],
  ["sendReplyBtn", "Send reply", "إرسال الرد"],
]);

// ═══════════════════════════════════════════════════════
// TEAM COACH EMPLOYEE DETAIL
// ═══════════════════════════════════════════════════════
addKeys("teamCoach", [
  ["employeesCannotAccess", "Employees cannot access this page.", "لا يمكن للموظفين الوصول لهذه الصفحة."],
  ["branchOnly", "You can only view employees in your assigned branch.", "يمكنك فقط عرض موظفي فرعك المعين."],
  ["featureGateTitle", "Employee Coach Summary is not available", "ملخص تدريب الموظف غير متاح"],
  ["viewPlans", "View plans", "عرض الباقات"],
  ["backToTeamCoach", "Back to Team Coach", "العودة لتدريب الفريق"],
  ["consistencyScore", "Consistency Score", "درجة الاتساق"],
  ["cachedSnapshot", "Cached snapshot from a previous generation.", "لقطة مخزنة من إنشاء سابق."],
  ["riskLevel", "Risk level:", "مستوى المخاطرة:"],
  ["positiveSummary", "Positive summary", "ملخص إيجابي"],
  ["improvementAreas", "Improvement areas", "مجالات التحسين"],
  ["noImprovementAreas", "No specific improvement areas this period.", "لا توجد مجالات تحسين محددة في هذه الفترة."],
  ["practicalAdvice", "Practical advice", "نصائح عملية"],
  ["tomorrowAction", "Tomorrow action", "إجراء الغد"],
  ["tagsCard", "Tags", "العلامات"],
  ["noCoachingData", "No coaching data yet", "لا توجد بيانات تدريب بعد"],
  ["coachingDataDesc", "This employee's coaching summary will appear after a few attendance records are available.", "سيظهر ملخص تدريب هذا الموظف بعد توفر بضعة سجلات حضور."],
  ["aiDisclaimer", "AI insights are for coaching support only and should not be used as the sole basis for disciplinary decisions.", "الاستنتاجات الذكية لدعم التدريب فقط ولا يجب استخدامها كأساس وحيد لقرارات التأديب."],
]);

// ═══════════════════════════════════════════════════════
// BILLING
// ═══════════════════════════════════════════════════════
addKeys("billing", [
  ["periodLabel", "Period:", "الفترة:"],
  ["branchesLabel", "Branches", "الفروع"],
  ["employeesLabel", "Employees", "الموظفون"],
  ["managersLabel", "Managers", "المديرون"],
  ["kiosksLabel", "Kiosks", "الأجهزة"],
]);

// ═══════════════════════════════════════════════════════
// COACH PAGE
// ═══════════════════════════════════════════════════════
addKeys("coach", [
  ["dailyMotivationReady", "Daily motivation ready", "التحفيز اليومي جاهز"],
  ["readTip", "Read today's coaching tip.", "اقرأ نصيحة التدريب اليومية."],
  ["noTipsAvailable", "No tips available yet.", "لا توجد نصائح متاحة بعد."],
  ["aiDisclaimer", "B-Coach AI provides development support only. It is not a replacement for HR judgment or legal compliance.", "B-Coach AI يوفر دعم التطوير فقط. لا يحل محل حكم الموارد البشرية أو الامتثال القانوني."],
]);

// ═══════════════════════════════════════════════════════
// MY LEAVE / MY WARNINGS / MY TRAINING / MY ASSETS page headings
// ═══════════════════════════════════════════════════════
addKeys("myLeave", [
  ["myLeaveTitle", "My Leave", "إجازاتي"],
]);
addKeys("myWarnings", [
  ["myWarningsTitle", "My Warnings", "تحذيراتي"],
]);
addKeys("myTraining", [
  ["myTrainingTitle", "My Training", "تدريباتي"],
]);
addKeys("myAssets", [
  ["myAssetsTitle", "My Assets", "أصولي"],
]);

// Write
fs.writeFileSync("messages/en.json", JSON.stringify(en, null, 2) + "\n");
fs.writeFileSync("messages/ar.json", JSON.stringify(ar, null, 2) + "\n");

console.log(`EN total: ${JSON.stringify(en).length} chars, namespaces: ${Object.keys(en).length}`);
console.log(`AR total: ${JSON.stringify(ar).length} chars, namespaces: ${Object.keys(ar).length}`);
console.log("Done!");
