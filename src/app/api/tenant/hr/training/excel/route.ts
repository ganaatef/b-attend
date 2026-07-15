import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logTenantEvent } from "@/lib/auth/audit";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { getRolePermissions, getManagedBranchIds, type HrPermission } from "@/lib/hr/permissions";
import {
  createWorkbook, addReportHeaderSheet, addWorksheetFromRows,
  sendWorkbookResponse, excelFilename,
  type ExcelColumn, type ExcelRow,
} from "@/lib/excel/exporter";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

const NO_RECORDS: ExcelRow[] = [{ msg: "No records found." }];
const EMPTY_COL: ExcelColumn[] = [{ key: "msg", label: "Info", width: 40 }];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const tid = session.tenantId;

  const featureCheck = await canUseHrFeature(tid, "hr_excel_export");
  if (!featureCheck.allowed) {
    const featureCheck2 = await canUseHrFeature(tid, "excel_export");
    if (!featureCheck2.allowed) {
      return NextResponse.json({ error: "Feature not available", reason: featureCheck2.reason ?? "Upgrade your plan." }, { status: 403 });
    }
  }

  if (!hasPerm(session.role, "EXPORT_HR_EXCEL")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  const subscription = await db.subscription.findUnique({ where: { tenantId: tid } });
  if (!subscription || subscription.status !== "ACTIVE") {
    return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
  }

  const tenant = await db.tenant.findUnique({ where: { id: tid }, select: { name: true } });

  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId");
  const employeeId = url.searchParams.get("employeeId");

  const isBranchManager = session.role === "BRANCH_MANAGER";
  const managedBranchIds = isBranchManager ? await getManagedBranchIds(session.sub, tid) : [];
  if (isBranchManager && managedBranchIds.length === 0) {
    return NextResponse.json({ error: "No branches assigned" }, { status: 403 });
  }

  const employeeWhere: any = { companyId: tid };
  if (branchId) {
    employeeWhere.branchId = branchId;
  } else if (isBranchManager) {
    employeeWhere.branchId = { in: managedBranchIds };
  }
  if (employeeId) {
    employeeWhere.id = employeeId;
  }

  const matchingEmployeeIds = (await db.employee.findMany({ where: employeeWhere, select: { id: true } })).map((e) => e.id);

  const courses = await db.trainingCourse.findMany({
    where: { companyId: tid },
    orderBy: { createdAt: "desc" },
  });

  const assignmentWhere: any = { companyId: tid, employeeId: { in: matchingEmployeeIds } };
  const assignments = await db.trainingAssignment.findMany({
    where: assignmentWhere,
    include: {
      employee: { select: { employeeCode: true, fullName: true, branch: { select: { name: true } }, department: { select: { name: true } } } },
      course: { select: { title: true, category: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const skills = await db.employeeSkill.findMany({
    where: { companyId: tid, employeeId: { in: matchingEmployeeIds } },
    include: {
      employee: { select: { employeeCode: true, fullName: true, branch: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const courseColumns: ExcelColumn[] = [
    { key: "title", label: "Title", width: 30 },
    { key: "category", label: "Category", width: 18 },
    { key: "description", label: "Description", width: 30 },
    { key: "requiredForJobTitle", label: "Required For", width: 20 },
    { key: "validityMonths", label: "Validity (Months)", width: 16 },
    { key: "active", label: "Active", width: 10 },
    { key: "assignmentsCount", label: "Assignments", width: 14 },
  ];
  const courseRows: ExcelRow[] = courses.map((c) => ({
    title: c.title,
    category: c.category.replace(/_/g, " "),
    description: c.description ?? "",
    requiredForJobTitle: c.requiredForJobTitle ?? "",
    validityMonths: c.validityMonths ?? "",
    active: c.active ? "Yes" : "No",
    assignmentsCount: assignments.filter((a) => a.courseId === c.id).length,
  }));

  const assignmentColumns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "department", label: "Department", width: 15 },
    { key: "course", label: "Course", width: 25 },
    { key: "category", label: "Category", width: 18 },
    { key: "assignedAt", label: "Assigned", width: 12 },
    { key: "dueDate", label: "Due Date", width: 12 },
    { key: "completedAt", label: "Completed", width: 12 },
    { key: "status", label: "Status", width: 14 },
    { key: "score", label: "Score", width: 8 },
    { key: "notes", label: "Notes", width: 25 },
  ];
  const assignmentRows: ExcelRow[] = assignments.map((a) => ({
    employeeCode: a.employee.employeeCode,
    employeeName: a.employee.fullName,
    branch: a.employee.branch?.name ?? "",
    department: a.employee.department?.name ?? "",
    course: a.course.title,
    category: a.course.category.replace(/_/g, " "),
    assignedAt: new Date(a.assignedAt).toLocaleDateString(),
    dueDate: a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "",
    completedAt: a.completedAt ? new Date(a.completedAt).toLocaleDateString() : "",
    status: a.status,
    score: a.score ?? "",
    notes: a.notes ?? "",
  }));

  const overdueAssignments = assignments.filter((a) => a.status === "OVERDUE");
  const overdueColumns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "course", label: "Course", width: 25 },
    { key: "assignedAt", label: "Assigned", width: 12 },
    { key: "dueDate", label: "Due Date", width: 12 },
    { key: "daysOverdue", label: "Days Overdue", width: 14 },
  ];
  const overdueRows: ExcelRow[] = overdueAssignments.map((a) => {
    const dueMs = a.dueDate ? new Date(a.dueDate).getTime() : Date.now();
    const daysOverdue = Math.max(0, Math.floor((Date.now() - dueMs) / (1000 * 60 * 60 * 24)));
    return {
      employeeCode: a.employee.employeeCode,
      employeeName: a.employee.fullName,
      branch: a.employee.branch?.name ?? "",
      course: a.course.title,
      assignedAt: new Date(a.assignedAt).toLocaleDateString(),
      dueDate: a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "",
      daysOverdue,
    };
  });

  const completedAssignments = assignments.filter((a) => a.status === "COMPLETED");
  const completedColumns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "course", label: "Course", width: 25 },
    { key: "completedAt", label: "Completed", width: 12 },
    { key: "score", label: "Score", width: 8 },
  ];
  const completedRows: ExcelRow[] = completedAssignments.map((a) => ({
    employeeCode: a.employee.employeeCode,
    employeeName: a.employee.fullName,
    branch: a.employee.branch?.name ?? "",
    course: a.course.title,
    completedAt: a.completedAt ? new Date(a.completedAt).toLocaleDateString() : "",
    score: a.score ?? "",
  }));

  const skillColumns: ExcelColumn[] = [
    { key: "employeeCode", label: "Employee Code", width: 15 },
    { key: "employeeName", label: "Employee Name", width: 25 },
    { key: "branch", label: "Branch", width: 15 },
    { key: "skillName", label: "Skill", width: 25 },
    { key: "level", label: "Level", width: 15 },
    { key: "verifiedAt", label: "Verified", width: 12 },
  ];
  const skillRows: ExcelRow[] = skills.map((s) => ({
    employeeCode: s.employee.employeeCode,
    employeeName: s.employee.fullName,
    branch: s.employee.branch?.name ?? "",
    skillName: s.skillName,
    level: s.level,
    verifiedAt: s.verifiedAt ? new Date(s.verifiedAt).toLocaleDateString() : "",
  }));

  const wb = createWorkbook();
  addReportHeaderSheet(wb, {
    companyName: tenant?.name ?? "Company",
    reportTitle: "Training Report",
    generatedBy: session.email,
    generatedAt: new Date(),
    filters: { branchId: branchId ?? "All", employeeId: employeeId ?? "All" },
  });
  addWorksheetFromRows(wb, "Courses", courseColumns, courseRows.length > 0 ? courseRows : NO_RECORDS);
  addWorksheetFromRows(wb, "Assignments", assignmentColumns, assignmentRows.length > 0 ? assignmentRows : NO_RECORDS);
  addWorksheetFromRows(wb, "Overdue Training", overdueColumns, overdueRows.length > 0 ? overdueRows : NO_RECORDS);
  addWorksheetFromRows(wb, "Completed Training", completedColumns, completedRows.length > 0 ? completedRows : NO_RECORDS);
  addWorksheetFromRows(wb, "Employee Skills", skillColumns, skillRows.length > 0 ? skillRows : NO_RECORDS);

  const filename = excelFilename("training-report");

  await logTenantEvent({
    companyId: tid, actorId: session.sub, actorEmail: session.email,
    action: "HR_EXCEL_EXPORTED", entityType: "Report", entityId: "training-report",
    reason: "Training report exported",
  });

  await db.reportExportLog.create({
    data: { companyId: tid, reportType: "training-report", filters: JSON.stringify({ branchId, employeeId }), rowCount: assignments.length + skills.length, fileName: filename, exportedById: session.sub, exportedByEmail: session.email },
  });

  return sendWorkbookResponse(wb, filename);
}
