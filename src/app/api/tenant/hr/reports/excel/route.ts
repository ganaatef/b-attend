import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  createWorkbook,
  addReportHeaderSheet,
  addWorksheetFromRows,
  sendWorkbookResponse,
  excelFilename,
  type ExcelColumn,
} from "@/lib/excel/exporter";
import { getRolePermissions } from "@/lib/hr/permissions";
import { logTenantEvent } from "@/lib/auth/audit";
import { canUseHrFeature } from "@/lib/hr/feature-gates";

const NO_RECORDS = [{ msg: "No records found." }];
const EMPTY_COL: ExcelColumn[] = [{ key: "msg", label: "Info", width: 40 }];

type ReportType =
  | "employee-master" | "headcount" | "contracts-expiry" | "documents-expiry"
  | "missing-documents" | "leave-balance" | "leave-usage" | "warnings"
  | "training" | "assets" | "onboarding" | "offboarding"
  | "payroll-profiles" | "payroll-runs" | "all";

const REPORT_TYPES: ReportType[] = [
  "employee-master", "headcount", "contracts-expiry", "documents-expiry",
  "missing-documents", "leave-balance", "leave-usage", "warnings",
  "training", "assets", "onboarding", "offboarding",
  "payroll-profiles", "payroll-runs",
];

export async function GET(
  req: NextRequest,
) {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tid = session.tenantId;
  const permissions = getRolePermissions(session.role);
  if (!permissions.includes("EXPORT_HR_EXCEL")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const excelGate = await canUseHrFeature(tid, "hr_excel_export");
  if (!excelGate.allowed) {
    const fallback = await canUseHrFeature(tid, "excel_export");
    if (!fallback.allowed) {
      return NextResponse.json({ error: fallback.reason ?? "Feature not available" }, { status: 403 });
    }
  }

  const subscription = await db.subscription.findUnique({ where: { tenantId: tid } });
  if (!subscription || subscription.status !== "ACTIVE") {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
  }

  const type = (req.nextUrl.searchParams.get("type") || "all") as ReportType;
  if (type !== "all" && !REPORT_TYPES.includes(type)) {
    return NextResponse.json({ error: `Invalid report type: ${type}` }, { status: 400 });
  }

  const isBranchManager = session.role === "BRANCH_MANAGER";
  const canViewPayroll = !isBranchManager && (session.role === "COMPANY_OWNER" || session.role === "HR_ADMIN" || permissions.includes("VIEW_PAYROLL"));

  const tenant = await db.tenant.findUnique({ where: { id: tid }, select: { name: true } });
  const wb = createWorkbook();
  const generatedAt = new Date();
  const generatedBy = session.email;

  addReportHeaderSheet(wb, {
    companyName: tenant?.name ?? "Company",
    reportTitle: `HR Report: ${type}`,
    generatedBy,
    generatedAt,
    filters: { type },
  });

  const branchFilter = isBranchManager
    ? { employee: { branch: { managerId: session.sub } } }
    : {};

  const want = (t: ReportType) => type === "all" || type === t;

  // ── 1. Employee Master ──
  if (want("employee-master")) {
    const employees = await db.employee.findMany({
      where: { companyId: tid, deletedAt: null, ...(isBranchManager ? { branch: { managerId: session.sub } } : {}) },
      include: { branch: { select: { name: true } }, department: { select: { name: true } }, jobTitleRef: { select: { title: true } } },
      orderBy: { fullName: "asc" },
    });
    const cols: ExcelColumn[] = [
      { key: "code", label: "Employee Code", width: 16 },
      { key: "name", label: "Full Name", width: 25 },
      { key: "arabicName", label: "Arabic Name", width: 20 },
      { key: "branch", label: "Branch", width: 18 },
      { key: "department", label: "Department", width: 18 },
      { key: "jobTitle", label: "Job Title", width: 18 },
      { key: "employmentType", label: "Employment Type", width: 16 },
      { key: "status", label: "Status", width: 12 },
      { key: "startDate", label: "Start Date", width: 14 },
      { key: "endDate", label: "End Date", width: 14 },
    ];
    const rows = employees.map((e) => ({
      code: e.employeeCode ?? "",
      name: e.fullName,
      arabicName: e.arabicName ?? "",
      branch: e.branch?.name ?? "",
      department: e.department?.name ?? "",
      jobTitle: e.jobTitleRef?.title ?? "",
      employmentType: e.employmentType?.replace(/_/g, " ") ?? "",
      status: e.status ?? "",
      startDate: e.startDate ? new Date(e.startDate).toLocaleDateString() : "",
      endDate: e.endDate ? new Date(e.endDate).toLocaleDateString() : "",
    }));
    addWorksheetFromRows(wb, "Employee Master", cols, rows.length > 0 ? rows : NO_RECORDS);
  }

  // ── 2. Headcount ──
  if (want("headcount")) {
    const employees = await db.employee.findMany({
      where: { companyId: tid, deletedAt: null },
      include: { branch: { select: { name: true } }, department: { select: { name: true } }, jobTitleRef: { select: { title: true } } },
    });
    const groups = new Map<string, { active: number; suspended: number; left: number; total: number }>();
    for (const e of employees) {
      const key = `${e.branch?.name ?? "Unassigned"} | ${e.department?.name ?? "Unassigned"} | ${e.jobTitleRef?.title ?? "Unassigned"} | ${(e.employmentType ?? "UNKNOWN").replace(/_/g, " ")}`;
      const g = groups.get(key) ?? { active: 0, suspended: 0, left: 0, total: 0 };
      if (e.status === "ACTIVE") g.active++;
      else if (e.status === "SUSPENDED") g.suspended++;
      else if (e.status === "LEFT") g.left++;
      g.total++;
      groups.set(key, g);
    }
    const cols: ExcelColumn[] = [
      { key: "group", label: "Branch | Department | Job Title | Type", width: 50 },
      { key: "active", label: "Active", width: 10 },
      { key: "suspended", label: "Suspended", width: 12 },
      { key: "left", label: "Left", width: 8 },
      { key: "total", label: "Total", width: 8 },
    ];
    const rows = [...groups.entries()].map(([group, g]) => ({ group, ...g }));
    addWorksheetFromRows(wb, "Headcount", cols, rows.length > 0 ? rows : NO_RECORDS);
  }

  // ── 3. Contracts Expiry ──
  if (want("contracts-expiry")) {
    const contracts = await db.employeeContract.findMany({
      where: { companyId: tid, status: "ACTIVE" },
      include: { employee: { select: { fullName: true, employeeCode: true, branch: { select: { name: true } }, department: { select: { name: true } } } } },
      orderBy: { endDate: "asc" },
    });
    const now = Date.now();
    const cols: ExcelColumn[] = [
      { key: "code", label: "Employee Code", width: 16 },
      { key: "name", label: "Employee", width: 25 },
      { key: "branch", label: "Branch", width: 18 },
      { key: "department", label: "Department", width: 18 },
      { key: "type", label: "Contract Type", width: 16 },
      { key: "startDate", label: "Start Date", width: 14 },
      { key: "endDate", label: "End Date", width: 14 },
      { key: "daysUntil", label: "Days Until Expiry", width: 16 },
      { key: "risk", label: "Risk Level", width: 12 },
    ];
    const rows = contracts.map((c) => {
      const daysUntil = c.endDate ? Math.ceil((new Date(c.endDate).getTime() - now) / 86400000) : null;
      const risk = daysUntil === null ? "Unknown" : daysUntil <= 7 ? "Critical" : daysUntil <= 30 ? "High" : daysUntil <= 90 ? "Medium" : "Low";
      return {
        code: c.employee?.employeeCode ?? "",
        name: c.employee?.fullName ?? "",
        branch: c.employee?.branch?.name ?? "",
        department: c.employee?.department?.name ?? "",
        type: c.contractType?.replace(/_/g, " ") ?? "",
        startDate: c.startDate ? new Date(c.startDate).toLocaleDateString() : "",
        endDate: c.endDate ? new Date(c.endDate).toLocaleDateString() : "",
        daysUntil: daysUntil ?? "",
        risk,
      };
    });
    addWorksheetFromRows(wb, "Contracts Expiry", cols, rows.length > 0 ? rows : NO_RECORDS);
  }

  // ── 4. Documents Expiry ──
  if (want("documents-expiry")) {
    const docs = await db.employeeDocument.findMany({
      where: { companyId: tid },
      include: { employee: { select: { fullName: true, employeeCode: true, branch: { select: { name: true } }, department: { select: { name: true } } } } },
      orderBy: { expiryDate: "asc" },
    });
    const now = Date.now();
    const cols: ExcelColumn[] = [
      { key: "code", label: "Employee Code", width: 16 },
      { key: "name", label: "Employee", width: 25 },
      { key: "branch", label: "Branch", width: 18 },
      { key: "department", label: "Department", width: 18 },
      { key: "docType", label: "Document Type", width: 20 },
      { key: "issueDate", label: "Issue Date", width: 14 },
      { key: "expiryDate", label: "Expiry Date", width: 14 },
      { key: "status", label: "Status", width: 14 },
      { key: "daysUntil", label: "Days Until Expiry", width: 16 },
    ];
    const rows = docs.map((d) => {
      const daysUntil = d.expiryDate ? Math.ceil((new Date(d.expiryDate).getTime() - now) / 86400000) : null;
      return {
        code: d.employee?.employeeCode ?? "",
        name: d.employee?.fullName ?? "",
        branch: d.employee?.branch?.name ?? "",
        department: d.employee?.department?.name ?? "",
        docType: d.documentType?.replace(/_/g, " ") ?? "",
        issueDate: d.issueDate ? new Date(d.issueDate).toLocaleDateString() : "",
        expiryDate: d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : "",
        status: d.status ?? "",
        daysUntil: daysUntil ?? "",
      };
    });
    addWorksheetFromRows(wb, "Documents Expiry", cols, rows.length > 0 ? rows : NO_RECORDS);
  }

  // ── 5. Missing Documents ──
  if (want("missing-documents")) {
    const docs = await db.employeeDocument.findMany({
      where: { companyId: tid, status: "MISSING" },
      include: { employee: { select: { fullName: true, employeeCode: true, branch: { select: { name: true } }, department: { select: { name: true } } } } },
    });
    const cols: ExcelColumn[] = [
      { key: "code", label: "Employee Code", width: 16 },
      { key: "name", label: "Employee", width: 25 },
      { key: "branch", label: "Branch", width: 18 },
      { key: "department", label: "Department", width: 18 },
      { key: "docType", label: "Document Type", width: 20 },
      { key: "status", label: "Status", width: 14 },
      { key: "notes", label: "Notes", width: 30 },
    ];
    const rows = docs.map((d) => ({
      code: d.employee?.employeeCode ?? "",
      name: d.employee?.fullName ?? "",
      branch: d.employee?.branch?.name ?? "",
      department: d.employee?.department?.name ?? "",
      docType: d.documentType?.replace(/_/g, " ") ?? "",
      status: d.status ?? "",
      notes: d.notes ?? "",
    }));
    addWorksheetFromRows(wb, "Missing Documents", cols, rows.length > 0 ? rows : NO_RECORDS);
  }

  // ── 6. Leave Balance ──
  if (want("leave-balance")) {
    const balances = await db.leaveBalance.findMany({
      where: { companyId: tid },
      include: {
        employee: { select: { fullName: true, employeeCode: true, branch: { select: { name: true } }, department: { select: { name: true } } } },
        leaveType: { select: { name: true } },
      },
    });
    const cols: ExcelColumn[] = [
      { key: "code", label: "Employee Code", width: 16 },
      { key: "name", label: "Employee", width: 25 },
      { key: "branch", label: "Branch", width: 18 },
      { key: "department", label: "Department", width: 18 },
      { key: "leaveType", label: "Leave Type", width: 18 },
      { key: "year", label: "Year", width: 8 },
      { key: "opening", label: "Opening", width: 10 },
      { key: "accrued", label: "Accrued", width: 10 },
      { key: "used", label: "Used", width: 10 },
      { key: "pending", label: "Pending", width: 10 },
      { key: "remaining", label: "Remaining", width: 10 },
    ];
    const rows = balances.map((b) => ({
      code: b.employee?.employeeCode ?? "",
      name: b.employee?.fullName ?? "",
      branch: b.employee?.branch?.name ?? "",
      department: b.employee?.department?.name ?? "",
      leaveType: b.leaveType?.name ?? "",
      year: b.year,
      opening: b.openingBalance,
      accrued: b.accrued,
      used: b.used,
      pending: b.pending,
      remaining: b.remaining,
    }));
    addWorksheetFromRows(wb, "Leave Balance", cols, rows.length > 0 ? rows : NO_RECORDS);
  }

  // ── 7. Leave Usage ──
  if (want("leave-usage")) {
    const leaves = await db.leaveRequest.findMany({
      where: { companyId: tid },
      include: {
        employee: { select: { fullName: true, employeeCode: true, branch: { select: { name: true } }, department: { select: { name: true } } } },
        leaveType: { select: { name: true } },
      },
      orderBy: { startDate: "desc" },
    });
    const cols: ExcelColumn[] = [
      { key: "code", label: "Employee Code", width: 16 },
      { key: "name", label: "Employee", width: 25 },
      { key: "branch", label: "Branch", width: 18 },
      { key: "department", label: "Department", width: 18 },
      { key: "leaveType", label: "Leave Type", width: 18 },
      { key: "startDate", label: "Start Date", width: 14 },
      { key: "endDate", label: "End Date", width: 14 },
      { key: "days", label: "Days", width: 8 },
      { key: "status", label: "Status", width: 12 },
      { key: "reason", label: "Reason", width: 25 },
    ];
    const rows = leaves.map((l) => ({
      code: l.employee?.employeeCode ?? "",
      name: l.employee?.fullName ?? "",
      branch: l.employee?.branch?.name ?? "",
      department: l.employee?.department?.name ?? "",
      leaveType: l.leaveType?.name ?? "",
      startDate: l.startDate ? new Date(l.startDate).toLocaleDateString() : "",
      endDate: l.endDate ? new Date(l.endDate).toLocaleDateString() : "",
      days: l.daysCount,
      status: l.status ?? "",
      reason: l.reason ?? "",
    }));
    addWorksheetFromRows(wb, "Leave Usage", cols, rows.length > 0 ? rows : NO_RECORDS);
  }

  // ── 8. Warnings ──
  if (want("warnings")) {
    const warnings = await db.employeeWarning.findMany({
      where: { companyId: tid },
      include: { employee: { select: { fullName: true, employeeCode: true, branch: { select: { name: true } }, department: { select: { name: true } } } } },
      orderBy: { date: "desc" },
    });
    const cols: ExcelColumn[] = [
      { key: "code", label: "Employee Code", width: 16 },
      { key: "name", label: "Employee", width: 25 },
      { key: "branch", label: "Branch", width: 18 },
      { key: "department", label: "Department", width: 18 },
      { key: "type", label: "Type", width: 16 },
      { key: "severity", label: "Severity", width: 12 },
      { key: "status", label: "Status", width: 14 },
      { key: "date", label: "Date", width: 14 },
      { key: "acknowledged", label: "Acknowledged", width: 14 },
    ];
    const rows = warnings.map((w) => ({
      code: w.employee?.employeeCode ?? "",
      name: w.employee?.fullName ?? "",
      branch: w.employee?.branch?.name ?? "",
      department: w.employee?.department?.name ?? "",
      type: w.type ?? "",
      severity: w.severity ?? "",
      status: w.status ?? "",
      date: w.date ? new Date(w.date).toLocaleDateString() : "",
      acknowledged: w.acknowledgedByEmployee ? "Yes" : "No",
    }));
    addWorksheetFromRows(wb, "Warnings", cols, rows.length > 0 ? rows : NO_RECORDS);
  }

  // ── 9. Training ──
  if (want("training")) {
    const assignments = await db.trainingAssignment.findMany({
      where: { companyId: tid },
      include: {
        employee: { select: { fullName: true, employeeCode: true, branch: { select: { name: true } }, department: { select: { name: true } } } },
        course: { select: { title: true, category: true } },
      },
      orderBy: { assignedAt: "desc" },
    });
    const cols: ExcelColumn[] = [
      { key: "code", label: "Employee Code", width: 16 },
      { key: "name", label: "Employee", width: 25 },
      { key: "branch", label: "Branch", width: 18 },
      { key: "department", label: "Department", width: 18 },
      { key: "course", label: "Course", width: 22 },
      { key: "category", label: "Category", width: 18 },
      { key: "status", label: "Status", width: 14 },
      { key: "assignedAt", label: "Assigned At", width: 14 },
      { key: "dueDate", label: "Due Date", width: 14 },
      { key: "completedAt", label: "Completed At", width: 14 },
      { key: "score", label: "Score", width: 8 },
    ];
    const rows = assignments.map((a) => ({
      code: a.employee?.employeeCode ?? "",
      name: a.employee?.fullName ?? "",
      branch: a.employee?.branch?.name ?? "",
      department: a.employee?.department?.name ?? "",
      course: a.course?.title ?? "",
      category: a.course?.category?.replace(/_/g, " ") ?? "",
      status: a.status ?? "",
      assignedAt: a.assignedAt ? new Date(a.assignedAt).toLocaleDateString() : "",
      dueDate: a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "",
      completedAt: a.completedAt ? new Date(a.completedAt).toLocaleDateString() : "",
      score: a.score ?? "",
    }));
    addWorksheetFromRows(wb, "Training", cols, rows.length > 0 ? rows : NO_RECORDS);
  }

  // ── 10. Assets ──
  if (want("assets")) {
    const assets = await db.asset.findMany({
      where: { companyId: tid },
      include: {
        assignments: {
          where: { status: "ASSIGNED" },
          include: { employee: { select: { fullName: true, employeeCode: true, branch: { select: { name: true } } } } },
          take: 1,
        },
      },
    });
    const cols: ExcelColumn[] = [
      { key: "code", label: "Asset Code", width: 16 },
      { key: "name", label: "Asset Name", width: 22 },
      { key: "type", label: "Type", width: 14 },
      { key: "status", label: "Status", width: 14 },
      { key: "assignedTo", label: "Assigned Employee", width: 25 },
      { key: "branch", label: "Branch", width: 18 },
      { key: "assignedAt", label: "Assigned At", width: 14 },
      { key: "condition", label: "Condition", width: 16 },
    ];
    const rows = assets.map((a) => {
      const assignment = a.assignments?.[0];
      return {
        code: a.code ?? "",
        name: a.name ?? "",
        type: a.type?.replace(/_/g, " ") ?? "",
        status: a.status ?? "",
        assignedTo: assignment?.employee?.fullName ?? "",
        branch: assignment?.employee?.branch?.name ?? "",
        assignedAt: assignment?.assignedAt ? new Date(assignment.assignedAt).toLocaleDateString() : "",
        condition: assignment?.conditionOnAssign ?? "",
      };
    });
    addWorksheetFromRows(wb, "Assets", cols, rows.length > 0 ? rows : NO_RECORDS);
  }

  // ── 11. Onboarding ──
  if (want("onboarding")) {
    const tasks = await db.onboardingTask.findMany({
      where: { companyId: tid },
      include: { employee: { select: { fullName: true, employeeCode: true, branch: { select: { name: true } }, department: { select: { name: true } } } } },
      orderBy: { dueDate: "asc" },
    });
    const empMap = new Map<string, { pending: number; completed: number; total: number }>();
    for (const t of tasks) {
      const eid = t.employeeId;
      const g = empMap.get(eid) ?? { pending: 0, completed: 0, total: 0 };
      g.total++;
      if (t.status === "COMPLETED") g.completed++;
      else g.pending++;
      empMap.set(eid, g);
    }
    const empList = await db.employee.findMany({
      where: { companyId: tid, id: { in: [...empMap.keys()] } },
      select: { id: true, fullName: true, employeeCode: true, branch: { select: { name: true } }, department: { select: { name: true } } },
    });
    const empLookup = new Map(empList.map((e) => [e.id, e]));
    const cols: ExcelColumn[] = [
      { key: "code", label: "Employee Code", width: 16 },
      { key: "name", label: "Employee", width: 25 },
      { key: "branch", label: "Branch", width: 18 },
      { key: "department", label: "Department", width: 18 },
      { key: "pending", label: "Pending Tasks", width: 14 },
      { key: "completed", label: "Completed Tasks", width: 16 },
      { key: "total", label: "Total Tasks", width: 12 },
      { key: "progress", label: "Progress %", width: 12 },
    ];
    const rows = [...empMap.entries()].map(([eid, g]) => {
      const emp = empLookup.get(eid);
      return {
        code: emp?.employeeCode ?? "",
        name: emp?.fullName ?? "",
        branch: emp?.branch?.name ?? "",
        department: emp?.department?.name ?? "",
        pending: g.pending,
        completed: g.completed,
        total: g.total,
        progress: g.total > 0 ? Math.round((g.completed / g.total) * 100) + "%" : "0%",
      };
    });
    addWorksheetFromRows(wb, "Onboarding", cols, rows.length > 0 ? rows : NO_RECORDS);
  }

  // ── 12. Offboarding ──
  if (want("offboarding")) {
    const tasks = await db.offboardingTask.findMany({
      where: { companyId: tid },
      include: { employee: { select: { fullName: true, employeeCode: true, branch: { select: { name: true } }, department: { select: { name: true } } } } },
      orderBy: { dueDate: "asc" },
    });
    const empMap = new Map<string, { pending: number; completed: number; total: number }>();
    for (const t of tasks) {
      const eid = t.employeeId;
      const g = empMap.get(eid) ?? { pending: 0, completed: 0, total: 0 };
      g.total++;
      if (t.status === "COMPLETED") g.completed++;
      else g.pending++;
      empMap.set(eid, g);
    }
    const empList = await db.employee.findMany({
      where: { companyId: tid, id: { in: [...empMap.keys()] } },
      select: { id: true, fullName: true, employeeCode: true, branch: { select: { name: true } }, department: { select: { name: true } }, endDate: true, status: true },
    });
    const empLookup = new Map(empList.map((e) => [e.id, e]));
    const cols: ExcelColumn[] = [
      { key: "code", label: "Employee Code", width: 16 },
      { key: "name", label: "Employee", width: 25 },
      { key: "branch", label: "Branch", width: 18 },
      { key: "department", label: "Department", width: 18 },
      { key: "lastDay", label: "Last Working Day", width: 16 },
      { key: "pending", label: "Pending Tasks", width: 14 },
      { key: "completed", label: "Completed Tasks", width: 16 },
      { key: "total", label: "Total Tasks", width: 12 },
      { key: "progress", label: "Progress %", width: 12 },
    ];
    const rows = [...empMap.entries()].map(([eid, g]) => {
      const emp = empLookup.get(eid);
      return {
        code: emp?.employeeCode ?? "",
        name: emp?.fullName ?? "",
        branch: emp?.branch?.name ?? "",
        department: emp?.department?.name ?? "",
        lastDay: emp?.endDate ? new Date(emp.endDate).toLocaleDateString() : "",
        pending: g.pending,
        completed: g.completed,
        total: g.total,
        progress: g.total > 0 ? Math.round((g.completed / g.total) * 100) + "%" : "0%",
      };
    });
    addWorksheetFromRows(wb, "Offboarding", cols, rows.length > 0 ? rows : NO_RECORDS);
  }

  // ── 13. Payroll Profiles ──
  if (want("payroll-profiles") && canViewPayroll) {
    const profiles = await db.payrollProfile.findMany({
      where: { companyId: tid },
      include: {
        employee: {
          select: {
            fullName: true, employeeCode: true,
            branch: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
    });
    const cols: ExcelColumn[] = [
      { key: "code", label: "Employee Code", width: 16 },
      { key: "name", label: "Employee", width: 25 },
      { key: "branch", label: "Branch", width: 18 },
      { key: "department", label: "Department", width: 18 },
      { key: "salaryType", label: "Salary Type", width: 14 },
      { key: "currency", label: "Currency", width: 10 },
      { key: "paymentMethod", label: "Payment Method", width: 18 },
      { key: "active", label: "Active", width: 8 },
    ];
    const rows = profiles.map((p) => ({
      code: p.employee?.employeeCode ?? "",
      name: p.employee?.fullName ?? "",
      branch: p.employee?.branch?.name ?? "",
      department: p.employee?.department?.name ?? "",
      salaryType: p.salaryType ?? "",
      currency: p.currency ?? "",
      paymentMethod: p.paymentMethod?.replace(/_/g, " ") ?? "",
      active: p.active ? "Yes" : "No",
    }));
    addWorksheetFromRows(wb, "Payroll Profiles", cols, rows.length > 0 ? rows : NO_RECORDS);
  }

  // ── 14. Payroll Run Summary ──
  if (want("payroll-runs") && canViewPayroll) {
    const runs = await db.payrollRun.findMany({
      where: { companyId: tid },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { _count: { select: { lines: true } } },
    });
    const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const cols: ExcelColumn[] = [
      { key: "month", label: "Month", width: 12 },
      { key: "year", label: "Year", width: 8 },
      { key: "status", label: "Status", width: 12 },
      { key: "employees", label: "Employees", width: 12 },
      { key: "lockedAt", label: "Locked At", width: 14 },
      { key: "notes", label: "Notes", width: 30 },
    ];
    const rows = runs.map((r) => ({
      month: monthNames[r.month] ?? String(r.month),
      year: r.year,
      status: r.status ?? "",
      employees: r._count.lines,
      lockedAt: r.lockedAt ? new Date(r.lockedAt).toLocaleDateString() : "",
      notes: r.notes ?? "",
    }));
    addWorksheetFromRows(wb, "Payroll Run Summary", cols, rows.length > 0 ? rows : NO_RECORDS);
  }

  const filename = excelFilename(`hr-report-${type}`);
  const reportCount = wb.worksheets.length;
  let totalRowCount = 0;
  for (const ws of wb.worksheets) {
    totalRowCount += ws.rowCount;
  }
  if (totalRowCount > reportCount) totalRowCount -= reportCount;

  await logTenantEvent({
    companyId: tid, actorId: session.sub, actorEmail: session.email,
    action: "HR_EXCEL_EXPORTED", entityType: "Report", entityId: type,
    reason: `HR report "${type}" exported (${reportCount} sheets, ~${totalRowCount} rows)`,
  });

  await db.reportExportLog.create({
    data: {
      companyId: tid, reportType: `hr-report-${type}`,
      filters: JSON.stringify({ type }),
      rowCount: totalRowCount,
      fileName: filename,
      exportedById: session.sub,
      exportedByEmail: session.email,
    },
  });

  return sendWorkbookResponse(wb, filename);
}
