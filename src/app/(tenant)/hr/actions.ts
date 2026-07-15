"use server";

/**
 * B-Attend HR Module Server Actions — Phase HR-5.
 *
 * Department CRUD, Job Title CRUD, Contract CRUD, Document CRUD,
 * Leave Type CRUD, Leave Request approve/reject/cancel,
 * Warnings, Training, Assets, Onboarding, Offboarding,
 * Payroll Profiles, Payroll Runs, Payroll Adjustments.
 * All actions enforce HR permissions + tenant session + companyId scoping.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { logTenantEvent } from "@/lib/auth/audit";
import { getRolePermissions, getManagedBranchIds, type HrPermission } from "@/lib/hr/permissions";
import { canUseHrFeature } from "@/lib/hr/feature-gates";

async function requireHrSession(): Promise<{ tenantId: string; userId: string; role: string; email: string }> {
  const s = await getSession();
  if (!s || s.kind !== "tenant" || !s.tenantId || !s.sub) throw new Error("FORBIDDEN");
  return { tenantId: s.tenantId, userId: s.sub, role: s.role, email: s.email };
}

function hasPermission(role: string, permission: HrPermission): boolean {
  return getRolePermissions(role).includes(permission);
}

// ─────────────────────────────────────────────
// Department CRUD
// ─────────────────────────────────────────────

const DepartmentSchema = z.object({
  name: z.string().min(1, "Department name is required"),
});

export async function createHrDepartmentAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_DEPARTMENTS")) return { ok: false, error: "Permission denied" };
  const parsed = DepartmentSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const name = parsed.data.name.trim();
  const existing = await db.department.findFirst({ where: { companyId: s.tenantId, name } });
  if (existing) return { ok: false, error: "Department already exists" };
  const dept = await db.department.create({
    data: { companyId: s.tenantId, name, code: name.slice(0, 3).toUpperCase() },
  });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "DEPARTMENT_CREATED", entityType: "Department", entityId: dept.id });
  revalidatePath("/hr/departments");
  return { ok: true };
}

export async function updateHrDepartmentAction(departmentId: string, data: Record<string, any>) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_DEPARTMENTS")) return { ok: false, error: "Permission denied" };
  const dept = await db.department.findFirst({ where: { id: departmentId, companyId: s.tenantId } });
  if (!dept) return { ok: false, error: "Department not found" };
  await db.department.update({ where: { id: departmentId }, data });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "DEPARTMENT_UPDATED", entityType: "Department", entityId: departmentId });
  revalidatePath("/hr/departments");
  return { ok: true };
}

export async function deleteHrDepartmentAction(departmentId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_DEPARTMENTS")) return { ok: false, error: "Permission denied" };
  const dept = await db.department.findFirst({ where: { id: departmentId, companyId: s.tenantId } });
  if (!dept) return { ok: false, error: "Department not found" };

  const employeeCount = await db.employee.count({ where: { departmentId, companyId: s.tenantId, deletedAt: null } });
  if (employeeCount > 0) {
    await db.department.update({ where: { id: departmentId }, data: { active: false } });
    await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "DEPARTMENT_DEACTIVATED", entityType: "Department", entityId: departmentId, reason: `Used by ${employeeCount} employees` });
    revalidatePath("/hr/departments");
    return { ok: true, deactivated: true, message: "This record is used by employees and was deactivated instead of deleted." };
  }

  await db.department.delete({ where: { id: departmentId } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "DEPARTMENT_DELETED", entityType: "Department", entityId: departmentId });
  revalidatePath("/hr/departments");
  return { ok: true };
}

// ─────────────────────────────────────────────
// Job Title CRUD
// ─────────────────────────────────────────────

const JobTitleSchema = z.object({
  title: z.string().min(1, "Job title is required"),
  departmentId: z.string().optional(),
  description: z.string().optional(),
  grade: z.string().optional(),
});

export async function createJobTitleAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_JOB_TITLES")) return { ok: false, error: "Permission denied" };
  const parsed = JobTitleSchema.safeParse({
    title: formData.get("title"),
    departmentId: formData.get("departmentId") || undefined,
    description: formData.get("description") || undefined,
    grade: formData.get("grade") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const title = parsed.data.title.trim();
  const existing = await db.jobTitle.findFirst({ where: { companyId: s.tenantId, title } });
  if (existing) return { ok: false, error: "Job title already exists" };
  const jt = await db.jobTitle.create({
    data: { companyId: s.tenantId, title, departmentId: parsed.data.departmentId || null, description: parsed.data.description || null, grade: parsed.data.grade || null, active: true },
  });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "JOB_TITLE_CREATED", entityType: "JobTitle", entityId: jt.id });
  revalidatePath("/hr/job-titles");
  return { ok: true };
}

export async function updateJobTitleAction(jobTitleId: string, data: Record<string, any>) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_JOB_TITLES")) return { ok: false, error: "Permission denied" };
  const jt = await db.jobTitle.findFirst({ where: { id: jobTitleId, companyId: s.tenantId } });
  if (!jt) return { ok: false, error: "Job title not found" };
  await db.jobTitle.update({ where: { id: jobTitleId }, data });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "JOB_TITLE_UPDATED", entityType: "JobTitle", entityId: jobTitleId });
  revalidatePath("/hr/job-titles");
  return { ok: true };
}

export async function deleteJobTitleAction(jobTitleId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_JOB_TITLES")) return { ok: false, error: "Permission denied" };
  const jt = await db.jobTitle.findFirst({ where: { id: jobTitleId, companyId: s.tenantId } });
  if (!jt) return { ok: false, error: "Job title not found" };

  const employeeCount = await db.employee.count({ where: { jobTitleId, companyId: s.tenantId, deletedAt: null } });
  if (employeeCount > 0) {
    await db.jobTitle.update({ where: { id: jobTitleId }, data: { active: false } });
    await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "JOB_TITLE_DEACTIVATED", entityType: "JobTitle", entityId: jobTitleId, reason: `Used by ${employeeCount} employees` });
    revalidatePath("/hr/job-titles");
    return { ok: true, deactivated: true, message: "This record is used by employees and was deactivated instead of deleted." };
  }

  await db.jobTitle.delete({ where: { id: jobTitleId } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "JOB_TITLE_DELETED", entityType: "JobTitle", entityId: jobTitleId });
  revalidatePath("/hr/job-titles");
  return { ok: true };
}

// ─────────────────────────────────────────────
// Contract CRUD
// ─────────────────────────────────────────────

const ContractSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  contractNumber: z.string().min(1, "Contract number is required"),
  contractType: z.enum(["FULL_TIME", "PART_TIME", "TEMPORARY", "DAILY_WORKER", "CONTRACTOR", "INTERNSHIP"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  probationEndDate: z.string().optional(),
  salaryReference: z.coerce.number().optional(),
  notes: z.string().optional(),
});

export async function createContractAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_CONTRACTS")) return { ok: false, error: "Permission denied" };
  const parsed = ContractSchema.safeParse({
    employeeId: formData.get("employeeId"),
    contractNumber: formData.get("contractNumber"),
    contractType: formData.get("contractType"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    probationEndDate: formData.get("probationEndDate") || undefined,
    salaryReference: formData.get("salaryReference") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const emp = await db.employee.findFirst({ where: { id: parsed.data.employeeId, companyId: s.tenantId, deletedAt: null } });
  if (!emp) return { ok: false, error: "Employee not found" };

  const existing = await db.employeeContract.findFirst({ where: { companyId: s.tenantId, contractNumber: parsed.data.contractNumber } });
  if (existing) return { ok: false, error: "Contract number already exists" };

  const contract = await db.employeeContract.create({
    data: {
      companyId: s.tenantId,
      employeeId: parsed.data.employeeId,
      contractNumber: parsed.data.contractNumber,
      contractType: parsed.data.contractType,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      probationEndDate: parsed.data.probationEndDate ? new Date(parsed.data.probationEndDate) : null,
      salaryReference: parsed.data.salaryReference,
      notes: parsed.data.notes || null,
      status: "DRAFT",
    },
  });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "CONTRACT_CREATED", entityType: "EmployeeContract", entityId: contract.id });
  revalidatePath("/hr/contracts");
  revalidatePath(`/employees/${parsed.data.employeeId}`);
  return { ok: true, id: contract.id };
}

export async function updateContractAction(contractId: string, data: Record<string, any>) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_CONTRACTS")) return { ok: false, error: "Permission denied" };
  const contract = await db.employeeContract.findFirst({ where: { id: contractId, companyId: s.tenantId } });
  if (!contract) return { ok: false, error: "Contract not found" };
  const updateData: Record<string, any> = {};
  if (data.status) updateData.status = data.status;
  if (data.endDate) updateData.endDate = new Date(data.endDate);
  if (data.probationEndDate) updateData.probationEndDate = new Date(data.probationEndDate);
  if (data.salaryReference !== undefined) updateData.salaryReference = data.salaryReference;
  if (data.notes !== undefined) updateData.notes = data.notes;
  await db.employeeContract.update({ where: { id: contractId }, data: updateData });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "CONTRACT_UPDATED", entityType: "EmployeeContract", entityId: contractId });
  revalidatePath("/hr/contracts");
  revalidatePath(`/employees/${contract.employeeId}`);
  return { ok: true };
}

export async function deleteContractAction(contractId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_CONTRACTS")) return { ok: false, error: "Permission denied" };
  const contract = await db.employeeContract.findFirst({ where: { id: contractId, companyId: s.tenantId } });
  if (!contract) return { ok: false, error: "Contract not found" };
  if (contract.status !== "DRAFT") return { ok: false, error: "Only draft contracts can be deleted. Use Terminate for active contracts." };
  await db.employeeContract.delete({ where: { id: contractId } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "CONTRACT_DELETED", entityType: "EmployeeContract", entityId: contractId });
  revalidatePath("/hr/contracts");
  revalidatePath(`/employees/${contract.employeeId}`);
  return { ok: true };
}

export async function renewContractAction(contractId: string, newEndDate: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_CONTRACTS")) return { ok: false, error: "Permission denied" };
  const contract = await db.employeeContract.findFirst({ where: { id: contractId, companyId: s.tenantId } });
  if (!contract) return { ok: false, error: "Contract not found" };
  if (contract.status !== "ACTIVE" && contract.status !== "EXPIRED") return { ok: false, error: "Can only renew active or expired contracts" };

  await db.$transaction([
    db.employeeContract.update({ where: { id: contractId }, data: { status: "RENEWED" } }),
    db.employeeContract.create({
      data: {
        companyId: s.tenantId,
        employeeId: contract.employeeId,
        contractNumber: `${contract.contractNumber}-R${Date.now().toString(36).toUpperCase()}`,
        contractType: contract.contractType,
        startDate: new Date(),
        endDate: new Date(newEndDate),
        probationEndDate: contract.probationEndDate,
        salaryReference: contract.salaryReference,
        notes: `Renewed from contract ${contract.contractNumber}`,
        status: "ACTIVE",
      },
    }),
  ]);
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "CONTRACT_RENEWED", entityType: "EmployeeContract", entityId: contractId, reason: `Renewed until ${newEndDate}` });
  revalidatePath("/hr/contracts");
  revalidatePath(`/employees/${contract.employeeId}`);
  return { ok: true };
}

export async function terminateContractAction(contractId: string, reason?: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_CONTRACTS")) return { ok: false, error: "Permission denied" };
  const contract = await db.employeeContract.findFirst({ where: { id: contractId, companyId: s.tenantId } });
  if (!contract) return { ok: false, error: "Contract not found" };
  if (contract.status !== "ACTIVE") return { ok: false, error: "Can only terminate active contracts" };

  await db.employeeContract.update({
    where: { id: contractId },
    data: { status: "TERMINATED", endDate: new Date() },
  });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "CONTRACT_TERMINATED", entityType: "EmployeeContract", entityId: contractId, reason: reason || "Terminated" });
  revalidatePath("/hr/contracts");
  revalidatePath(`/employees/${contract.employeeId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────
// Document CRUD
// ─────────────────────────────────────────────

const DocumentSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  documentType: z.enum(["NATIONAL_ID", "PASSPORT", "WORK_PERMIT", "HEALTH_CERTIFICATE", "FOOD_SAFETY_CERTIFICATE", "CONTRACT", "INSURANCE_FORM", "MEDICAL_CERTIFICATE", "OTHER"]),
  documentNumber: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function createDocumentAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_DOCUMENTS")) return { ok: false, error: "Permission denied" };
  const parsed = DocumentSchema.safeParse({
    employeeId: formData.get("employeeId"),
    documentType: formData.get("documentType"),
    documentNumber: formData.get("documentNumber") || undefined,
    issueDate: formData.get("issueDate") || undefined,
    expiryDate: formData.get("expiryDate") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const emp = await db.employee.findFirst({ where: { id: parsed.data.employeeId, companyId: s.tenantId, deletedAt: null } });
  if (!emp) return { ok: false, error: "Employee not found" };

  const doc = await db.employeeDocument.create({
    data: {
      companyId: s.tenantId,
      employeeId: parsed.data.employeeId,
      documentType: parsed.data.documentType,
      documentNumber: parsed.data.documentNumber || null,
      issueDate: parsed.data.issueDate ? new Date(parsed.data.issueDate) : null,
      expiryDate: parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : null,
      notes: parsed.data.notes || null,
      status: "PENDING_REVIEW",
    },
  });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "DOCUMENT_CREATED", entityType: "EmployeeDocument", entityId: doc.id });
  revalidatePath("/hr/documents");
  revalidatePath(`/employees/${parsed.data.employeeId}`);
  return { ok: true, id: doc.id };
}

export async function updateDocumentAction(documentId: string, data: Record<string, any>) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_DOCUMENTS")) return { ok: false, error: "Permission denied" };
  const doc = await db.employeeDocument.findFirst({ where: { id: documentId, companyId: s.tenantId } });
  if (!doc) return { ok: false, error: "Document not found" };
  const updateData: Record<string, any> = {};
  if (data.status) updateData.status = data.status;
  if (data.documentNumber !== undefined) updateData.documentNumber = data.documentNumber;
  if (data.expiryDate) updateData.expiryDate = new Date(data.expiryDate);
  if (data.issueDate) updateData.issueDate = new Date(data.issueDate);
  if (data.notes !== undefined) updateData.notes = data.notes;
  await db.employeeDocument.update({ where: { id: documentId }, data: updateData });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "DOCUMENT_UPDATED", entityType: "EmployeeDocument", entityId: documentId });
  revalidatePath("/hr/documents");
  revalidatePath(`/employees/${doc.employeeId}`);
  return { ok: true };
}

export async function deleteDocumentAction(documentId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_DOCUMENTS")) return { ok: false, error: "Permission denied" };
  const doc = await db.employeeDocument.findFirst({ where: { id: documentId, companyId: s.tenantId } });
  if (!doc) return { ok: false, error: "Document not found" };
  await db.employeeDocument.delete({ where: { id: documentId } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "DOCUMENT_DELETED", entityType: "EmployeeDocument", entityId: documentId });
  revalidatePath("/hr/documents");
  revalidatePath(`/employees/${doc.employeeId}`);
  return { ok: true };
}

export async function markDocumentExpiredAction(documentId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_DOCUMENTS")) return { ok: false, error: "Permission denied" };
  const doc = await db.employeeDocument.findFirst({ where: { id: documentId, companyId: s.tenantId } });
  if (!doc) return { ok: false, error: "Document not found" };
  await db.employeeDocument.update({ where: { id: documentId }, data: { status: "EXPIRED" } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "DOCUMENT_EXPIRED", entityType: "EmployeeDocument", entityId: documentId });
  revalidatePath("/hr/documents");
  revalidatePath(`/employees/${doc.employeeId}`);
  return { ok: true };
}

export async function markDocumentMissingAction(documentId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_DOCUMENTS")) return { ok: false, error: "Permission denied" };
  const doc = await db.employeeDocument.findFirst({ where: { id: documentId, companyId: s.tenantId } });
  if (!doc) return { ok: false, error: "Document not found" };
  await db.employeeDocument.update({ where: { id: documentId }, data: { status: "MISSING" } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "DOCUMENT_MARKED_MISSING", entityType: "EmployeeDocument", entityId: documentId });
  revalidatePath("/hr/documents");
  revalidatePath(`/employees/${doc.employeeId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────
// Leave Type CRUD
// ─────────────────────────────────────────────

const LeaveTypeSchema = z.object({
  name: z.string().min(1, "Leave type name is required"),
  code: z.string().min(1, "Code is required"),
  paid: z.coerce.boolean().default(true),
  requiresApproval: z.coerce.boolean().default(true),
  annualAllowanceDays: z.coerce.number().int().min(0).default(0),
  carryForwardAllowed: z.coerce.boolean().default(false),
});

export async function createLeaveTypeAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_LEAVE_TYPES")) return { ok: false, error: "Permission denied" };
  const parsed = LeaveTypeSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    paid: formData.get("paid") ?? true,
    requiresApproval: formData.get("requiresApproval") ?? true,
    annualAllowanceDays: formData.get("annualAllowanceDays") ?? 0,
    carryForwardAllowed: formData.get("carryForwardAllowed") ?? false,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const existing = await db.leaveType.findFirst({ where: { companyId: s.tenantId, code: parsed.data.code } });
  if (existing) return { ok: false, error: "Leave type code already exists" };

  const lt = await db.leaveType.create({
    data: { companyId: s.tenantId, ...parsed.data },
  });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "LEAVE_TYPE_CREATED", entityType: "LeaveType", entityId: lt.id });
  revalidatePath("/hr/leaves");
  return { ok: true };
}

export async function updateLeaveTypeAction(leaveTypeId: string, data: Record<string, any>) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_LEAVE_TYPES")) return { ok: false, error: "Permission denied" };
  const lt = await db.leaveType.findFirst({ where: { id: leaveTypeId, companyId: s.tenantId } });
  if (!lt) return { ok: false, error: "Leave type not found" };
  const updateData: Record<string, any> = {};
  if (data.name) updateData.name = data.name;
  if (data.paid !== undefined) updateData.paid = data.paid;
  if (data.requiresApproval !== undefined) updateData.requiresApproval = data.requiresApproval;
  if (data.annualAllowanceDays !== undefined) updateData.annualAllowanceDays = data.annualAllowanceDays;
  if (data.carryForwardAllowed !== undefined) updateData.carryForwardAllowed = data.carryForwardAllowed;
  if (data.active !== undefined) updateData.active = data.active;
  await db.leaveType.update({ where: { id: leaveTypeId }, data: updateData });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "LEAVE_TYPE_UPDATED", entityType: "LeaveType", entityId: leaveTypeId });
  revalidatePath("/hr/leaves");
  return { ok: true };
}

export async function deleteLeaveTypeAction(leaveTypeId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_LEAVE_TYPES")) return { ok: false, error: "Permission denied" };
  const lt = await db.leaveType.findFirst({ where: { id: leaveTypeId, companyId: s.tenantId } });
  if (!lt) return { ok: false, error: "Leave type not found" };

  const usageCount = await db.leaveRequest.count({ where: { leaveTypeId, companyId: s.tenantId } });
  if (usageCount > 0) {
    await db.leaveType.update({ where: { id: leaveTypeId }, data: { active: false } });
    await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "LEAVE_TYPE_DEACTIVATED", entityType: "LeaveType", entityId: leaveTypeId, reason: `Used by ${usageCount} leave requests` });
    revalidatePath("/hr/leaves");
    return { ok: true, deactivated: true, message: "This leave type has existing requests and was deactivated instead of deleted." };
  }

  await db.leaveType.delete({ where: { id: leaveTypeId } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "LEAVE_TYPE_DELETED", entityType: "LeaveType", entityId: leaveTypeId });
  revalidatePath("/hr/leaves");
  return { ok: true };
}

// ─────────────────────────────────────────────
// Leave Request Actions
// ─────────────────────────────────────────────

const LeaveRequestSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  leaveTypeId: z.string().min(1, "Leave type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().optional(),
});

export async function createLeaveRequestAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "APPROVE_LEAVE") && !hasPermission(s.role, "MANAGE_LEAVE_BALANCES")) return { ok: false, error: "Permission denied" };
  const parsed = LeaveRequestSchema.safeParse({
    employeeId: formData.get("employeeId"),
    leaveTypeId: formData.get("leaveTypeId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const emp = await db.employee.findFirst({ where: { id: parsed.data.employeeId, companyId: s.tenantId, deletedAt: null } });
  if (!emp) return { ok: false, error: "Employee not found" };

  const lt = await db.leaveType.findFirst({ where: { id: parsed.data.leaveTypeId, companyId: s.tenantId, active: true } });
  if (!lt) return { ok: false, error: "Leave type not found" };

  const start = new Date(parsed.data.startDate);
  const end = new Date(parsed.data.endDate);
  const daysCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (daysCount < 1) return { ok: false, error: "End date must be on or after start date" };

  const lr = await db.leaveRequest.create({
    data: {
      companyId: s.tenantId,
      employeeId: parsed.data.employeeId,
      leaveTypeId: parsed.data.leaveTypeId,
      startDate: start,
      endDate: end,
      daysCount,
      reason: parsed.data.reason || null,
      status: lt.requiresApproval ? "PENDING" : "APPROVED",
      requestedById: s.userId,
    },
  });

  if (!lt.requiresApproval) {
    await db.leaveBalance.updateMany({
      where: { employeeId: parsed.data.employeeId, leaveTypeId: parsed.data.leaveTypeId, year: start.getFullYear(), companyId: s.tenantId },
      data: { pending: { decrement: daysCount }, used: { increment: daysCount }, remaining: { decrement: daysCount } },
    });
  } else {
    await db.leaveBalance.updateMany({
      where: { employeeId: parsed.data.employeeId, leaveTypeId: parsed.data.leaveTypeId, year: start.getFullYear(), companyId: s.tenantId },
      data: { pending: { increment: daysCount } },
    });
  }

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "LEAVE_REQUEST_CREATED", entityType: "LeaveRequest", entityId: lr.id, reason: `${daysCount} days ${lt.name}` });
  revalidatePath("/hr/leaves");
  revalidatePath(`/employees/${parsed.data.employeeId}`);
  return { ok: true, id: lr.id };
}

export async function approveLeaveRequestAction(leaveRequestId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "APPROVE_LEAVE")) return { ok: false, error: "Permission denied" };
  const lr = await db.leaveRequest.findFirst({ where: { id: leaveRequestId, companyId: s.tenantId } });
  if (!lr) return { ok: false, error: "Leave request not found" };
  if (lr.status !== "PENDING") return { ok: false, error: "Request is not pending" };

  if (s.role === "BRANCH_MANAGER") {
    const emp = await db.employee.findFirst({ where: { id: lr.employeeId, companyId: s.tenantId, deletedAt: null } });
    if (!emp) return { ok: false, error: "Employee not found" };
    if (!emp.branchId) return { ok: false, error: "Employee has no branch assigned" };
    const managedIds = await getManagedBranchIds(s.userId, s.tenantId);
    if (!managedIds.includes(emp.branchId)) return { ok: false, error: "Permission denied: employee not in your branch" };
  }

  const start = new Date(lr.startDate);
  const end = new Date(lr.endDate);
  const days: Date[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  await db.$transaction(async (tx) => {
    await tx.leaveRequest.update({
      where: { id: leaveRequestId },
      data: { status: "APPROVED", approvedById: s.userId, approvedAt: new Date() },
    });
    await tx.leaveBalance.updateMany({
      where: { employeeId: lr.employeeId, leaveTypeId: lr.leaveTypeId, year: start.getFullYear(), companyId: s.tenantId },
      data: { pending: { decrement: lr.daysCount }, used: { increment: lr.daysCount }, remaining: { decrement: lr.daysCount } },
    });
    for (const day of days) {
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      await tx.attendanceDay.upsert({
        where: { companyId_employeeId_date: { companyId: s.tenantId, employeeId: lr.employeeId, date: dayStart } },
        create: { companyId: s.tenantId, employeeId: lr.employeeId, date: dayStart, status: "LEAVE", notes: "Leave approved" },
        update: { status: "LEAVE", notes: "Leave approved" },
      });
      const existingSchedule = await tx.schedule.findFirst({
        where: { companyId: s.tenantId, employeeId: lr.employeeId, date: dayStart },
      });
      if (existingSchedule) {
        await tx.schedule.update({
          where: { id: existingSchedule.id },
          data: { status: "LEAVE", notes: "Leave approved" },
        });
      }
    }
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "LEAVE_REQUEST_APPROVED", entityType: "LeaveRequest", entityId: leaveRequestId, reason: `${lr.daysCount} days approved` });
  revalidatePath("/hr/leaves");
  revalidatePath(`/employees/${lr.employeeId}`);
  return { ok: true };
}

export async function rejectLeaveRequestAction(leaveRequestId: string, managerNotes?: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "APPROVE_LEAVE")) return { ok: false, error: "Permission denied" };
  const lr = await db.leaveRequest.findFirst({ where: { id: leaveRequestId, companyId: s.tenantId } });
  if (!lr) return { ok: false, error: "Leave request not found" };
  if (lr.status !== "PENDING") return { ok: false, error: "Request is not pending" };

  if (s.role === "BRANCH_MANAGER") {
    const emp = await db.employee.findFirst({ where: { id: lr.employeeId, companyId: s.tenantId, deletedAt: null } });
    if (!emp) return { ok: false, error: "Employee not found" };
    if (!emp.branchId) return { ok: false, error: "Employee has no branch assigned" };
    const managedIds = await getManagedBranchIds(s.userId, s.tenantId);
    if (!managedIds.includes(emp.branchId)) return { ok: false, error: "Permission denied: employee not in your branch" };
  }

  await db.leaveRequest.update({
    where: { id: leaveRequestId },
    data: { status: "REJECTED", rejectedById: s.userId, rejectedAt: new Date(), managerNotes: managerNotes || null },
  });
  await db.leaveBalance.updateMany({
    where: { employeeId: lr.employeeId, leaveTypeId: lr.leaveTypeId, year: lr.startDate.getFullYear(), companyId: s.tenantId },
    data: { pending: { decrement: lr.daysCount } },
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "LEAVE_REQUEST_REJECTED", entityType: "LeaveRequest", entityId: leaveRequestId, reason: managerNotes || "Rejected" });
  revalidatePath("/hr/leaves");
  revalidatePath(`/employees/${lr.employeeId}`);
  return { ok: true };
}

export async function cancelLeaveRequestAction(leaveRequestId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "APPROVE_LEAVE")) return { ok: false, error: "Permission denied" };
  const lr = await db.leaveRequest.findFirst({ where: { id: leaveRequestId, companyId: s.tenantId } });
  if (!lr) return { ok: false, error: "Leave request not found" };
  if (lr.status !== "PENDING") {
    if (lr.status === "APPROVED") return { ok: false, error: "Approved leave reversal is not available in this version. Please handle this through a future HR-only reversal workflow." };
    return { ok: false, error: "Cannot cancel request in current status" };
  }

  if (s.role === "BRANCH_MANAGER") {
    const emp = await db.employee.findFirst({ where: { id: lr.employeeId, companyId: s.tenantId, deletedAt: null } });
    if (!emp) return { ok: false, error: "Employee not found" };
    if (!emp.branchId) return { ok: false, error: "Employee has no branch assigned" };
    const managedIds = await getManagedBranchIds(s.userId, s.tenantId);
    if (!managedIds.includes(emp.branchId)) return { ok: false, error: "Permission denied: employee not in your branch" };
  }

  await db.$transaction(async (tx) => {
    await tx.leaveRequest.update({ where: { id: leaveRequestId }, data: { status: "CANCELLED" } });
    await tx.leaveBalance.updateMany({
      where: { employeeId: lr.employeeId, leaveTypeId: lr.leaveTypeId, year: lr.startDate.getFullYear(), companyId: s.tenantId },
      data: { pending: { decrement: lr.daysCount } },
    });
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "LEAVE_REQUEST_CANCELLED", entityType: "LeaveRequest", entityId: leaveRequestId });
  revalidatePath("/hr/leaves");
  revalidatePath(`/employees/${lr.employeeId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────
// Employee Self-Service Leave
// ─────────────────────────────────────────────

export type LeaveFormState = { ok: boolean; error: string; id: string };

export async function createEmployeeLeaveRequestAction(prev: LeaveFormState, formData: FormData): Promise<LeaveFormState> {
  const s = await getSession();
  if (!s || s.kind !== "tenant" || !s.tenantId) return { ok: false, error: "Authentication required", id: "" };

  const featureCheck = await canUseHrFeature(s.tenantId, "hr_leave");
  if (!featureCheck.allowed) return { ok: false, error: featureCheck.reason ?? "Leave feature not available on your plan", id: "" };

  const user = await db.user.findUnique({ where: { id: s.sub }, include: { employee: true } });
  if (!user?.employee) return { ok: false, error: "No employee profile linked to your account", id: "" };
  const employeeId = user.employee.id;

  const leaveTypeId = formData.get("leaveTypeId") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const reason = (formData.get("reason") as string) || "";

  if (!leaveTypeId || !startDate || !endDate) return { ok: false, error: "All fields are required", id: "" };

  const lt = await db.leaveType.findFirst({ where: { id: leaveTypeId, companyId: s.tenantId, active: true } });
  if (!lt) return { ok: false, error: "Leave type not found", id: "" };

  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (daysCount < 1) return { ok: false, error: "End date must be on or after start date", id: "" };

  const lr = await db.leaveRequest.create({
    data: {
      companyId: s.tenantId,
      employeeId,
      leaveTypeId,
      startDate: start,
      endDate: end,
      daysCount,
      reason: reason || null,
      status: lt.requiresApproval ? "PENDING" : "APPROVED",
      requestedById: s.sub,
    },
  });

  if (lt.requiresApproval) {
    await db.leaveBalance.updateMany({
      where: { employeeId, leaveTypeId, year: start.getFullYear(), companyId: s.tenantId },
      data: { pending: { increment: daysCount } },
    });
  } else {
    await db.leaveBalance.updateMany({
      where: { employeeId, leaveTypeId, year: start.getFullYear(), companyId: s.tenantId },
      data: { pending: { decrement: daysCount }, used: { increment: daysCount }, remaining: { decrement: daysCount } },
    });
  }

  await logTenantEvent({ companyId: s.tenantId, actorId: s.sub, actorEmail: s.email, action: "LEAVE_REQUEST_CREATED", entityType: "LeaveRequest", entityId: lr.id, reason: `${daysCount} days ${lt.name} (self-service)` });
  revalidatePath("/my-leave");
  revalidatePath("/requests");
  return { ok: true, error: "", id: lr.id };
}

export async function cancelEmployeeLeaveRequestAction(leaveRequestId: string) {
  const s = await getSession();
  if (!s || s.kind !== "tenant" || !s.tenantId) return { ok: false, error: "Authentication required" };

  const featureCheck = await canUseHrFeature(s.tenantId, "hr_leave");
  if (!featureCheck.allowed) return { ok: false, error: featureCheck.reason ?? "Leave feature not available on your plan" };

  const user = await db.user.findUnique({ where: { id: s.sub }, include: { employee: true } });
  if (!user?.employee) return { ok: false, error: "No employee profile linked" };

  const lr = await db.leaveRequest.findFirst({ where: { id: leaveRequestId, companyId: s.tenantId, employeeId: user.employee.id } });
  if (!lr) return { ok: false, error: "Leave request not found" };
  if (lr.status !== "PENDING") return { ok: false, error: "Only pending requests can be cancelled" };

  await db.$transaction(async (tx) => {
    await tx.leaveRequest.update({ where: { id: leaveRequestId }, data: { status: "CANCELLED" } });
    await tx.leaveBalance.updateMany({
      where: { employeeId: user.employee!.id, leaveTypeId: lr.leaveTypeId, year: lr.startDate.getFullYear(), companyId: s.tenantId! },
      data: { pending: { decrement: lr.daysCount } },
    });
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.sub, actorEmail: s.email, action: "LEAVE_REQUEST_CANCELLED", entityType: "LeaveRequest", entityId: leaveRequestId, reason: "Cancelled by employee (self-service)" });
  revalidatePath("/my-leave");
  return { ok: true };
}

// ─────────────────────────────────────────────
// HR-4: WARNINGS
// ─────────────────────────────────────────────

const warningSchema = z.object({ employeeId: z.string().min(1), type: z.string().min(1), severity: z.string().min(1), date: z.string().min(1), reason: z.string().min(1), actionTaken: z.string().optional(), notes: z.string().optional(), branchId: z.string().optional() });

export async function createWarningAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_WARNINGS")) return { ok: false, error: "Permission denied" };

  const parsed = warningSchema.safeParse({ employeeId: formData.get("employeeId"), type: formData.get("type"), severity: formData.get("severity"), date: formData.get("date"), reason: formData.get("reason"), actionTaken: formData.get("actionTaken") || undefined, notes: formData.get("notes") || undefined, branchId: formData.get("branchId") || undefined });
  if (!parsed.success) return { ok: false, error: parsed.error.flatten().fieldErrors.employeeId?.[0] ?? "Invalid data" };

  const employee = await db.employee.findFirst({ where: { id: parsed.data.employeeId, companyId: s.tenantId, deletedAt: null } });
  if (!employee) return { ok: false, error: "Employee not found" };

  const warning = await db.employeeWarning.create({
    data: { companyId: s.tenantId, employeeId: parsed.data.employeeId, branchId: parsed.data.branchId || employee.branchId, type: parsed.data.type as any, severity: parsed.data.severity as any, date: new Date(parsed.data.date), reason: parsed.data.reason, actionTaken: parsed.data.actionTaken, notes: parsed.data.notes, issuedById: s.userId },
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "WARNING_CREATED", entityType: "EmployeeWarning", entityId: warning.id });
  revalidatePath("/hr/warnings");
  revalidatePath(`/employees/${parsed.data.employeeId}`);
  return { ok: true, id: warning.id };
}

export async function updateWarningAction(warningId: string, data: { status?: string; notes?: string; actionTaken?: string }) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_WARNINGS")) return { ok: false, error: "Permission denied" };
  const w = await db.employeeWarning.findFirst({ where: { id: warningId, companyId: s.tenantId } });
  if (!w) return { ok: false, error: "Warning not found" };

  await db.employeeWarning.update({ where: { id: warningId }, data: { ...(data.status && { status: data.status as any }), ...(data.notes !== undefined && { notes: data.notes }), ...(data.actionTaken !== undefined && { actionTaken: data.actionTaken }) } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "WARNING_UPDATED", entityType: "EmployeeWarning", entityId: warningId });
  revalidatePath("/hr/warnings");
  revalidatePath(`/hr/warnings/${warningId}`);
  revalidatePath(`/employees/${w.employeeId}`);
  return { ok: true };
}

export async function acknowledgeWarningAction(warningId: string) {
  const s = await getSession();
  if (!s?.tenantId || s.kind !== "tenant") return { ok: false, error: "Authentication required" };

  const user = await db.user.findUnique({ where: { id: s.sub }, include: { employee: true } });
  if (!user?.employee) return { ok: false, error: "No employee profile" };

  const w = await db.employeeWarning.findFirst({ where: { id: warningId, companyId: s.tenantId, employeeId: user.employee.id } });
  if (!w) return { ok: false, error: "Warning not found" };
  if (w.acknowledgedByEmployee) return { ok: false, error: "Already acknowledged" };

  await db.employeeWarning.update({ where: { id: warningId }, data: { acknowledgedByEmployee: true, acknowledgedAt: new Date() } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.sub, actorEmail: s.email, action: "WARNING_ACKNOWLEDGED", entityType: "EmployeeWarning", entityId: warningId });
  revalidatePath("/my-warnings");
  revalidatePath(`/employees/${user.employee.id}`);
  return { ok: true };
}

export async function resolveWarningAction(warningId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_WARNINGS")) return { ok: false, error: "Permission denied" };
  const w = await db.employeeWarning.findFirst({ where: { id: warningId, companyId: s.tenantId } });
  if (!w) return { ok: false, error: "Warning not found" };

  await db.employeeWarning.update({ where: { id: warningId }, data: { status: "RESOLVED" } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "WARNING_RESOLVED", entityType: "EmployeeWarning", entityId: warningId });
  revalidatePath("/hr/warnings");
  revalidatePath(`/hr/warnings/${warningId}`);
  revalidatePath(`/employees/${w.employeeId}`);
  return { ok: true };
}

export async function cancelWarningAction(warningId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_WARNINGS")) return { ok: false, error: "Permission denied" };
  const w = await db.employeeWarning.findFirst({ where: { id: warningId, companyId: s.tenantId } });
  if (!w) return { ok: false, error: "Warning not found" };

  await db.employeeWarning.update({ where: { id: warningId }, data: { status: "CANCELLED" } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "WARNING_CANCELLED", entityType: "EmployeeWarning", entityId: warningId });
  revalidatePath("/hr/warnings");
  revalidatePath(`/hr/warnings/${warningId}`);
  revalidatePath(`/employees/${w.employeeId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────
// HR-4: TRAINING
// ─────────────────────────────────────────────

const courseSchema = z.object({ title: z.string().min(1), description: z.string().optional(), category: z.string().min(1), requiredForJobTitle: z.string().optional(), validityMonths: z.string().optional() });

export async function createTrainingCourseAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_TRAINING")) return { ok: false, error: "Permission denied" };

  const parsed = courseSchema.safeParse({ title: formData.get("title"), description: formData.get("description") || undefined, category: formData.get("category"), requiredForJobTitle: formData.get("requiredForJobTitle") || undefined, validityMonths: formData.get("validityMonths") || undefined });
  if (!parsed.success) return { ok: false, error: "Invalid data" };

  const course = await db.trainingCourse.create({
    data: { companyId: s.tenantId, title: parsed.data.title, description: parsed.data.description, category: parsed.data.category as any, requiredForJobTitle: parsed.data.requiredForJobTitle || undefined, validityMonths: parsed.data.validityMonths ? parseInt(parsed.data.validityMonths) : undefined },
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "TRAINING_COURSE_CREATED", entityType: "TrainingCourse", entityId: course.id });
  revalidatePath("/hr/training");
  revalidatePath("/hr/training/courses");
  return { ok: true, id: course.id };
}

export async function updateTrainingCourseAction(courseId: string, data: { title?: string; description?: string; category?: string; active?: boolean }) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_TRAINING")) return { ok: false, error: "Permission denied" };
  const c = await db.trainingCourse.findFirst({ where: { id: courseId, companyId: s.tenantId } });
  if (!c) return { ok: false, error: "Course not found" };

  await db.trainingCourse.update({ where: { id: courseId }, data: { ...(data.title && { title: data.title }), ...(data.description !== undefined && { description: data.description }), ...(data.category && { category: data.category as any }), ...(data.active !== undefined && { active: data.active }) } });
  const action = data.active === false ? "TRAINING_COURSE_DEACTIVATED" : "TRAINING_COURSE_UPDATED";
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action, entityType: "TrainingCourse", entityId: courseId });
  revalidatePath("/hr/training");
  revalidatePath("/hr/training/courses");
  revalidatePath(`/hr/training/courses/${courseId}`);
  return { ok: true };
}

export async function deactivateTrainingCourseAction(courseId: string) {
  return updateTrainingCourseAction(courseId, { active: false });
}

const assignTrainingSchema = z.object({ employeeId: z.string().min(1), courseId: z.string().min(1), dueDate: z.string().optional(), notes: z.string().optional() });

export async function assignTrainingAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_TRAINING")) return { ok: false, error: "Permission denied" };

  const parsed = assignTrainingSchema.safeParse({ employeeId: formData.get("employeeId"), courseId: formData.get("courseId"), dueDate: formData.get("dueDate") || undefined, notes: formData.get("notes") || undefined });
  if (!parsed.success) return { ok: false, error: "Invalid data" };

  const existing = await db.trainingAssignment.findFirst({ where: { companyId: s.tenantId, employeeId: parsed.data.employeeId, courseId: parsed.data.courseId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } } });
  if (existing) return { ok: false, error: "Employee already has this course assigned" };

  const assignment = await db.trainingAssignment.create({
    data: { companyId: s.tenantId, employeeId: parsed.data.employeeId, courseId: parsed.data.courseId, dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined, notes: parsed.data.notes },
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "TRAINING_ASSIGNED", entityType: "TrainingAssignment", entityId: assignment.id });
  revalidatePath("/hr/training");
  revalidatePath("/hr/training/assignments");
  revalidatePath(`/employees/${parsed.data.employeeId}`);
  return { ok: true, id: assignment.id };
}

export async function markTrainingInProgressAction(assignmentId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_TRAINING")) return { ok: false, error: "Permission denied" };
  const a = await db.trainingAssignment.findFirst({ where: { id: assignmentId, companyId: s.tenantId } });
  if (!a) return { ok: false, error: "Assignment not found" };
  if (a.status !== "ASSIGNED") return { ok: false, error: "Assignment must be ASSIGNED" };

  await db.trainingAssignment.update({ where: { id: assignmentId }, data: { status: "IN_PROGRESS" } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "TRAINING_IN_PROGRESS", entityType: "TrainingAssignment", entityId: assignmentId });
  revalidatePath("/hr/training");
  revalidatePath(`/employees/${a.employeeId}`);
  return { ok: true };
}

export async function markTrainingCompletedAction(assignmentId: string, score?: number) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_TRAINING")) return { ok: false, error: "Permission denied" };
  const a = await db.trainingAssignment.findFirst({ where: { id: assignmentId, companyId: s.tenantId } });
  if (!a) return { ok: false, error: "Assignment not found" };
  if (a.status === "CANCELLED") return { ok: false, error: "Cannot complete a cancelled assignment" };
  if (a.status === "COMPLETED") return { ok: false, error: "Assignment already completed" };

  await db.trainingAssignment.update({ where: { id: assignmentId }, data: { status: "COMPLETED", completedAt: new Date(), ...(score !== undefined && { score }) } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "TRAINING_COMPLETED", entityType: "TrainingAssignment", entityId: assignmentId });
  revalidatePath("/hr/training");
  revalidatePath(`/employees/${a.employeeId}`);
  return { ok: true };
}

export async function cancelTrainingAssignmentAction(assignmentId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_TRAINING")) return { ok: false, error: "Permission denied" };
  const a = await db.trainingAssignment.findFirst({ where: { id: assignmentId, companyId: s.tenantId } });
  if (!a) return { ok: false, error: "Assignment not found" };

  await db.trainingAssignment.update({ where: { id: assignmentId }, data: { status: "CANCELLED" } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "TRAINING_CANCELLED", entityType: "TrainingAssignment", entityId: assignmentId });
  revalidatePath("/hr/training");
  revalidatePath(`/employees/${a.employeeId}`);
  return { ok: true };
}

const skillSchema = z.object({ employeeId: z.string().min(1), skillName: z.string().min(1), level: z.string().min(1) });

export async function addEmployeeSkillAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_TRAINING")) return { ok: false, error: "Permission denied" };

  const parsed = skillSchema.safeParse({ employeeId: formData.get("employeeId"), skillName: formData.get("skillName"), level: formData.get("level") });
  if (!parsed.success) return { ok: false, error: "Invalid data" };

  const skill = await db.employeeSkill.create({
    data: { companyId: s.tenantId, employeeId: parsed.data.employeeId, skillName: parsed.data.skillName, level: parsed.data.level as any, verifiedById: s.userId, verifiedAt: new Date() },
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "SKILL_ADDED", entityType: "EmployeeSkill", entityId: skill.id });
  revalidatePath(`/employees/${parsed.data.employeeId}`);
  return { ok: true, id: skill.id };
}

export async function updateEmployeeSkillAction(skillId: string, data: { level?: string }) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_TRAINING")) return { ok: false, error: "Permission denied" };
  const sk = await db.employeeSkill.findFirst({ where: { id: skillId, companyId: s.tenantId } });
  if (!sk) return { ok: false, error: "Skill not found" };

  await db.employeeSkill.update({ where: { id: skillId }, data: { ...(data.level && { level: data.level as any }) } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "SKILL_UPDATED", entityType: "EmployeeSkill", entityId: skillId });
  revalidatePath(`/employees/${sk.employeeId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────
// HR-4: ASSETS
// ─────────────────────────────────────────────

const assetSchema = z.object({ name: z.string().min(1), type: z.string().min(1), code: z.string().optional(), notes: z.string().optional() });

export async function createAssetAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_ASSETS")) return { ok: false, error: "Permission denied" };

  const parsed = assetSchema.safeParse({ name: formData.get("name"), type: formData.get("type"), code: formData.get("code") || undefined, notes: formData.get("notes") || undefined });
  if (!parsed.success) return { ok: false, error: "Invalid data" };

  if (parsed.data.code) {
    const existing = await db.asset.findFirst({ where: { companyId: s.tenantId, code: parsed.data.code } });
    if (existing) return { ok: false, error: "Asset code already exists" };
  }

  const asset = await db.asset.create({
    data: { companyId: s.tenantId, name: parsed.data.name, type: parsed.data.type as any, code: parsed.data.code || undefined, notes: parsed.data.notes },
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "ASSET_CREATED", entityType: "Asset", entityId: asset.id });
  revalidatePath("/hr/assets");
  return { ok: true, id: asset.id };
}

export async function updateAssetAction(assetId: string, data: { name?: string; type?: string; notes?: string }) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_ASSETS")) return { ok: false, error: "Permission denied" };
  const a = await db.asset.findFirst({ where: { id: assetId, companyId: s.tenantId } });
  if (!a) return { ok: false, error: "Asset not found" };

  await db.asset.update({ where: { id: assetId }, data: { ...(data.name && { name: data.name }), ...(data.type && { type: data.type as any }), ...(data.notes !== undefined && { notes: data.notes }) } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "ASSET_UPDATED", entityType: "Asset", entityId: assetId });
  revalidatePath("/hr/assets");
  revalidatePath(`/hr/assets/${assetId}`);
  return { ok: true };
}

const assignAssetSchema = z.object({ assetId: z.string().min(1), employeeId: z.string().min(1), conditionOnAssign: z.string().optional(), notes: z.string().optional() });

export async function assignAssetAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_ASSETS")) return { ok: false, error: "Permission denied" };

  const parsed = assignAssetSchema.safeParse({ assetId: formData.get("assetId"), employeeId: formData.get("employeeId"), conditionOnAssign: formData.get("conditionOnAssign") || undefined, notes: formData.get("notes") || undefined });
  if (!parsed.success) return { ok: false, error: "Invalid data" };

  const asset = await db.asset.findFirst({ where: { id: parsed.data.assetId, companyId: s.tenantId } });
  if (!asset) return { ok: false, error: "Asset not found" };
  if (asset.status !== "AVAILABLE") return { ok: false, error: "Asset is not available for assignment" };

  await db.$transaction(async (tx) => {
    await tx.assetAssignment.create({ data: { companyId: s.tenantId, assetId: parsed.data.assetId, employeeId: parsed.data.employeeId, conditionOnAssign: parsed.data.conditionOnAssign, notes: parsed.data.notes } });
    await tx.asset.update({ where: { id: parsed.data.assetId }, data: { status: "ASSIGNED" } });
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "ASSET_ASSIGNED", entityType: "AssetAssignment", entityId: parsed.data.assetId, reason: `Assigned to ${parsed.data.employeeId}` });
  revalidatePath("/hr/assets");
  revalidatePath("/hr/assets/assignments");
  revalidatePath(`/employees/${parsed.data.employeeId}`);
  return { ok: true };
}

export async function returnAssetAction(assignmentId: string, conditionOnReturn?: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_ASSETS")) return { ok: false, error: "Permission denied" };
  const aa = await db.assetAssignment.findFirst({ where: { id: assignmentId, companyId: s.tenantId } });
  if (!aa) return { ok: false, error: "Assignment not found" };
  if (aa.status !== "ASSIGNED") return { ok: false, error: "Assignment is not active" };

  await db.$transaction(async (tx) => {
    await tx.assetAssignment.update({ where: { id: assignmentId }, data: { status: "RETURNED", returnedAt: new Date(), conditionOnReturn: conditionOnReturn || undefined } });
    await tx.asset.update({ where: { id: aa.assetId }, data: { status: "AVAILABLE" } });
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "ASSET_RETURNED", entityType: "AssetAssignment", entityId: assignmentId });
  revalidatePath("/hr/assets");
  revalidatePath("/hr/assets/assignments");
  revalidatePath(`/employees/${aa.employeeId}`);
  return { ok: true };
}

export async function markAssetLostAction(assignmentId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_ASSETS")) return { ok: false, error: "Permission denied" };
  const aa = await db.assetAssignment.findFirst({ where: { id: assignmentId, companyId: s.tenantId } });
  if (!aa) return { ok: false, error: "Assignment not found" };
  if (aa.status !== "ASSIGNED") return { ok: false, error: "Only active assignments can be marked as lost" };

  await db.$transaction(async (tx) => {
    await tx.assetAssignment.update({ where: { id: assignmentId }, data: { status: "LOST" } });
    await tx.asset.update({ where: { id: aa.assetId }, data: { status: "LOST" } });
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "ASSET_MARKED_LOST", entityType: "AssetAssignment", entityId: assignmentId });
  revalidatePath("/hr/assets");
  return { ok: true };
}

export async function markAssetDamagedAction(assignmentId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_ASSETS")) return { ok: false, error: "Permission denied" };
  const aa = await db.assetAssignment.findFirst({ where: { id: assignmentId, companyId: s.tenantId } });
  if (!aa) return { ok: false, error: "Assignment not found" };
  if (aa.status !== "ASSIGNED") return { ok: false, error: "Only active assignments can be marked as damaged" };

  await db.$transaction(async (tx) => {
    await tx.assetAssignment.update({ where: { id: assignmentId }, data: { status: "DAMAGED" } });
    await tx.asset.update({ where: { id: aa.assetId }, data: { status: "DAMAGED" } });
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "ASSET_MARKED_DAMAGED", entityType: "AssetAssignment", entityId: assignmentId });
  revalidatePath("/hr/assets");
  return { ok: true };
}

export async function retireAssetAction(assetId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_ASSETS")) return { ok: false, error: "Permission denied" };
  const a = await db.asset.findFirst({ where: { id: assetId, companyId: s.tenantId } });
  if (!a) return { ok: false, error: "Asset not found" };
  if (a.status !== "AVAILABLE") return { ok: false, error: "Only available assets can be retired" };

  await db.$transaction(async (tx) => {
    await tx.asset.update({ where: { id: assetId }, data: { status: "RETIRED" } });
    await tx.assetAssignment.updateMany({ where: { assetId, companyId: s.tenantId, status: "ASSIGNED" }, data: { status: "RETURNED", returnedAt: new Date() } });
  });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "ASSET_RETIRED", entityType: "Asset", entityId: assetId });
  revalidatePath("/hr/assets");
  revalidatePath(`/hr/assets/${assetId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────
// HR-4: ONBOARDING
// ─────────────────────────────────────────────

const onboardingTaskSchema = z.object({ employeeId: z.string().min(1), title: z.string().min(1), description: z.string().optional(), dueDate: z.string().optional() });

export async function createOnboardingTaskAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_ONBOARDING")) return { ok: false, error: "Permission denied" };

  const parsed = onboardingTaskSchema.safeParse({ employeeId: formData.get("employeeId"), title: formData.get("title"), description: formData.get("description") || undefined, dueDate: formData.get("dueDate") || undefined });
  if (!parsed.success) return { ok: false, error: "Invalid data" };

  const task = await db.onboardingTask.create({
    data: { companyId: s.tenantId, employeeId: parsed.data.employeeId, title: parsed.data.title, description: parsed.data.description, dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined, assignedToId: s.userId },
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "ONBOARDING_TASK_CREATED", entityType: "OnboardingTask", entityId: task.id });
  revalidatePath("/hr/onboarding");
  revalidatePath(`/hr/onboarding/${parsed.data.employeeId}`);
  return { ok: true, id: task.id };
}

export async function updateOnboardingTaskAction(taskId: string, data: { title?: string; description?: string; dueDate?: Date }) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_ONBOARDING")) return { ok: false, error: "Permission denied" };
  const t = await db.onboardingTask.findFirst({ where: { id: taskId, companyId: s.tenantId } });
  if (!t) return { ok: false, error: "Task not found" };

  await db.onboardingTask.update({ where: { id: taskId }, data: { ...(data.title && { title: data.title }), ...(data.description !== undefined && { description: data.description }), ...(data.dueDate && { dueDate: data.dueDate }) } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "ONBOARDING_TASK_UPDATED", entityType: "OnboardingTask", entityId: taskId });
  revalidatePath("/hr/onboarding");
  revalidatePath(`/hr/onboarding/${t.employeeId}`);
  return { ok: true };
}

export async function completeOnboardingTaskAction(taskId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_ONBOARDING")) return { ok: false, error: "Permission denied" };
  const t = await db.onboardingTask.findFirst({ where: { id: taskId, companyId: s.tenantId } });
  if (!t) return { ok: false, error: "Task not found" };
  if (t.status === "COMPLETED") return { ok: false, error: "Already completed" };

  await db.onboardingTask.update({ where: { id: taskId }, data: { status: "COMPLETED", completedById: s.userId, completedAt: new Date() } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "ONBOARDING_TASK_COMPLETED", entityType: "OnboardingTask", entityId: taskId });
  revalidatePath("/hr/onboarding");
  revalidatePath(`/hr/onboarding/${t.employeeId}`);
  revalidatePath(`/employees/${t.employeeId}`);
  return { ok: true };
}

export async function cancelOnboardingTaskAction(taskId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_ONBOARDING")) return { ok: false, error: "Permission denied" };
  const t = await db.onboardingTask.findFirst({ where: { id: taskId, companyId: s.tenantId } });
  if (!t) return { ok: false, error: "Task not found" };

  await db.onboardingTask.update({ where: { id: taskId }, data: { status: "CANCELLED" } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "ONBOARDING_TASK_CANCELLED", entityType: "OnboardingTask", entityId: taskId });
  revalidatePath("/hr/onboarding");
  revalidatePath(`/hr/onboarding/${t.employeeId}`);
  return { ok: true };
}

export async function createDefaultOnboardingChecklistAction(employeeId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_ONBOARDING")) return { ok: false, error: "Permission denied" };

  const existing = await db.onboardingTask.findMany({ where: { companyId: s.tenantId, employeeId } });
  if (existing.length > 0) return { ok: false, error: "Onboarding checklist already exists" };

  const defaultTasks = [
    { title: "Add employee profile", description: "Complete all employee profile fields" },
    { title: "Upload required documents", description: "Collect and upload required identity and work documents" },
    { title: "Create contract", description: "Draft and sign employment contract" },
    { title: "Assign branch and department", description: "Assign employee to correct branch and department" },
    { title: "Assign shift policy", description: "Set up working hours and shift schedule" },
    { title: "Assign uniform/assets", description: "Provide necessary uniforms and equipment" },
    { title: "Assign onboarding training", description: "Schedule required onboarding training courses" },
    { title: "Create first schedule", description: "Generate initial work schedule" },
    { title: "Explain clock-in process", description: "Walk through attendance and clock-in system" },
    { title: "Confirm employee portal access", description: "Verify employee can access their portal" },
  ];

  await db.$transaction(async (tx) => {
    for (const dt of defaultTasks) {
      await tx.onboardingTask.create({
        data: { companyId: s.tenantId, employeeId, title: dt.title, description: dt.description, assignedToId: s.userId },
      });
    }
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "ONBOARDING_TASK_CREATED", entityType: "OnboardingTask", entityId: employeeId, reason: "Default checklist created" });
  revalidatePath("/hr/onboarding");
  revalidatePath(`/hr/onboarding/${employeeId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────
// HR-4: OFFBOARDING
// ─────────────────────────────────────────────

const offboardingTaskSchema = z.object({ employeeId: z.string().min(1), title: z.string().min(1), description: z.string().optional(), dueDate: z.string().optional() });

export async function startOffboardingAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_OFFBOARDING")) return { ok: false, error: "Permission denied" };

  const employeeId = formData.get("employeeId") as string;
  const lastDay = formData.get("lastWorkingDay") as string;
  if (!employeeId || !lastDay) return { ok: false, error: "Employee and last working day required" };

  const employee = await db.employee.findFirst({ where: { id: employeeId, companyId: s.tenantId, deletedAt: null } });
  if (!employee) return { ok: false, error: "Employee not found" };

  const defaultTasks = [
    { title: "Confirm last working day", description: "Verify and confirm the employee's last working day" },
    { title: "Disable user access", description: "Disable portal and system access" },
    { title: "Collect assets/uniform", description: "Collect all assigned company assets and uniforms" },
    { title: "Close open advances placeholder", description: "Settle any outstanding advances" },
    { title: "Finalize attendance", description: "Export and finalize attendance records" },
    { title: "Export employee final report", description: "Generate comprehensive employee report" },
    { title: "Archive employee profile", description: "Archive employee records" },
    { title: "Upload exit documents placeholder", description: "Upload any exit interview or separation documents" },
  ];

  await db.$transaction(async (tx) => {
    for (const dt of defaultTasks) {
      await tx.offboardingTask.create({
        data: { companyId: s.tenantId, employeeId, title: dt.title, description: dt.description, assignedToId: s.userId },
      });
    }
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "OFFBOARDING_STARTED", entityType: "OffboardingTask", entityId: employeeId, reason: `Last day: ${lastDay}` });
  revalidatePath("/hr/offboarding");
  revalidatePath(`/hr/offboarding/${employeeId}`);
  return { ok: true };
}

export async function createOffboardingTaskAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_OFFBOARDING")) return { ok: false, error: "Permission denied" };

  const parsed = offboardingTaskSchema.safeParse({ employeeId: formData.get("employeeId"), title: formData.get("title"), description: formData.get("description") || undefined, dueDate: formData.get("dueDate") || undefined });
  if (!parsed.success) return { ok: false, error: "Invalid data" };

  const task = await db.offboardingTask.create({
    data: { companyId: s.tenantId, employeeId: parsed.data.employeeId, title: parsed.data.title, description: parsed.data.description, dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined, assignedToId: s.userId },
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "OFFBOARDING_TASK_CREATED", entityType: "OffboardingTask", entityId: task.id });
  revalidatePath("/hr/offboarding");
  revalidatePath(`/hr/offboarding/${parsed.data.employeeId}`);
  return { ok: true, id: task.id };
}

export async function completeOffboardingTaskAction(taskId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_OFFBOARDING")) return { ok: false, error: "Permission denied" };
  const t = await db.offboardingTask.findFirst({ where: { id: taskId, companyId: s.tenantId } });
  if (!t) return { ok: false, error: "Task not found" };

  await db.offboardingTask.update({ where: { id: taskId }, data: { status: "COMPLETED", completedById: s.userId, completedAt: new Date() } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "OFFBOARDING_TASK_COMPLETED", entityType: "OffboardingTask", entityId: taskId });
  revalidatePath("/hr/offboarding");
  revalidatePath(`/hr/offboarding/${t.employeeId}`);
  return { ok: true };
}

export async function cancelOffboardingTaskAction(taskId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_OFFBOARDING")) return { ok: false, error: "Permission denied" };
  const t = await db.offboardingTask.findFirst({ where: { id: taskId, companyId: s.tenantId } });
  if (!t) return { ok: false, error: "Task not found" };

  await db.offboardingTask.update({ where: { id: taskId }, data: { status: "CANCELLED" } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "OFFBOARDING_TASK_CANCELLED", entityType: "OffboardingTask", entityId: taskId });
  revalidatePath("/hr/offboarding");
  revalidatePath(`/hr/offboarding/${t.employeeId}`);
  return { ok: true };
}

export async function finalizeOffboardingAction(employeeId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_OFFBOARDING")) return { ok: false, error: "Permission denied" };

  const employee = await db.employee.findFirst({ where: { id: employeeId, companyId: s.tenantId, deletedAt: null } });
  if (!employee) return { ok: false, error: "Employee not found" };

  const tasks = await db.offboardingTask.findMany({ where: { companyId: s.tenantId, employeeId } });
  const pendingTasks = tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED");
  if (pendingTasks.length > 0) return { ok: false, error: `${pendingTasks.length} tasks still pending` };

  await db.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: employeeId }, data: { status: "LEFT", endDate: new Date() } });
    if (employee.userId) {
      await tx.user.update({ where: { id: employee.userId }, data: { status: "SUSPENDED" } });
    }
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "EMPLOYEE_LEFT", entityType: "Employee", entityId: employeeId, reason: "Offboarding finalized" });
  if (employee.userId) {
    await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "USER_ACCESS_DISABLED", entityType: "User", entityId: employee.userId, reason: "Offboarding finalized" });
  }
  revalidatePath("/hr/offboarding");
  revalidatePath(`/hr/offboarding/${employeeId}`);
  revalidatePath(`/employees/${employeeId}`);
  return { ok: true };
}

export async function disableEmployeeUserAccessAction(employeeId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_OFFBOARDING")) return { ok: false, error: "Permission denied" };

  const employee = await db.employee.findFirst({ where: { id: employeeId, companyId: s.tenantId, deletedAt: null } });
  if (!employee) return { ok: false, error: "Employee not found" };
  if (!employee.userId) return { ok: false, error: "No linked user account" };

  await db.user.update({ where: { id: employee.userId }, data: { status: "SUSPENDED" } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "USER_ACCESS_DISABLED", entityType: "User", entityId: employee.userId, reason: "Explicitly disabled during offboarding" });
  revalidatePath(`/hr/offboarding/${employeeId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────
// HR-5: PAYROLL PROFILES
// ─────────────────────────────────────────────

const payrollProfileSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  baseSalary: z.coerce.number().int().min(0, "Base salary must be non-negative"),
  salaryType: z.enum(["MONTHLY", "DAILY", "HOURLY"]),
  currency: z.string().min(1).default("EGP"),
  paymentMethod: z.string().default("BANK_TRANSFER"),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  walletNumber: z.string().optional(),
  dailyRate: z.coerce.number().int().optional(),
  hourlyRate: z.coerce.number().int().optional(),
  overtimeRateMultiplier: z.coerce.number().min(0).default(1.5),
  lateDeductionRule: z.string().optional(),
  absenceDeductionRule: z.string().optional(),
});

export async function createPayrollProfileAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_PAYROLL")) return { ok: false, error: "Permission denied" };
  if (s.role === "BRANCH_MANAGER") return { ok: false, error: "Branch Manager cannot manage payroll" };

  const parsed = payrollProfileSchema.safeParse({
    employeeId: formData.get("employeeId"),
    baseSalary: formData.get("baseSalary"),
    salaryType: formData.get("salaryType"),
    currency: formData.get("currency"),
    paymentMethod: formData.get("paymentMethod"),
    bankName: formData.get("bankName") || undefined,
    bankAccount: formData.get("bankAccount") || undefined,
    walletNumber: formData.get("walletNumber") || undefined,
    dailyRate: formData.get("dailyRate") || undefined,
    hourlyRate: formData.get("hourlyRate") || undefined,
    overtimeRateMultiplier: formData.get("overtimeRateMultiplier"),
    lateDeductionRule: formData.get("lateDeductionRule") || undefined,
    absenceDeductionRule: formData.get("absenceDeductionRule") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const emp = await db.employee.findFirst({ where: { id: parsed.data.employeeId, companyId: s.tenantId, deletedAt: null } });
  if (!emp) return { ok: false, error: "Employee not found" };

  const existing = await db.payrollProfile.findFirst({ where: { employeeId: parsed.data.employeeId, companyId: s.tenantId, active: true } });
  if (existing) return { ok: false, error: "Employee already has an active payroll profile. Deactivate it first." };

  const profile = await db.payrollProfile.create({
    data: { companyId: s.tenantId, ...parsed.data },
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "PAYROLL_PROFILE_CREATED", entityType: "PayrollProfile", entityId: profile.id, reason: `${emp.fullName} — ${parsed.data.salaryType} ${parsed.data.baseSalary} ${parsed.data.currency}` });
  revalidatePath("/hr/payroll-profiles");
  revalidatePath(`/hr/payroll-profiles/${parsed.data.employeeId}`);
  revalidatePath(`/employees/${parsed.data.employeeId}`);
  return { ok: true, id: profile.id };
}

export async function updatePayrollProfileAction(profileId: string, data: Record<string, any>) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_PAYROLL")) return { ok: false, error: "Permission denied" };
  if (s.role === "BRANCH_MANAGER") return { ok: false, error: "Branch Manager cannot manage payroll" };

  const profile = await db.payrollProfile.findFirst({ where: { id: profileId, companyId: s.tenantId } });
  if (!profile) return { ok: false, error: "Payroll profile not found" };

  const updateData: Record<string, any> = {};
  if (data.baseSalary !== undefined) updateData.baseSalary = data.baseSalary;
  if (data.salaryType) updateData.salaryType = data.salaryType;
  if (data.currency) updateData.currency = data.currency;
  if (data.paymentMethod) updateData.paymentMethod = data.paymentMethod;
  if (data.bankName !== undefined) updateData.bankName = data.bankName;
  if (data.bankAccount !== undefined) updateData.bankAccount = data.bankAccount;
  if (data.walletNumber !== undefined) updateData.walletNumber = data.walletNumber;
  if (data.dailyRate !== undefined) updateData.dailyRate = data.dailyRate;
  if (data.hourlyRate !== undefined) updateData.hourlyRate = data.hourlyRate;
  if (data.overtimeRateMultiplier !== undefined) updateData.overtimeRateMultiplier = data.overtimeRateMultiplier;
  if (data.lateDeductionRule !== undefined) updateData.lateDeductionRule = data.lateDeductionRule;
  if (data.absenceDeductionRule !== undefined) updateData.absenceDeductionRule = data.absenceDeductionRule;
  if (data.active !== undefined) updateData.active = data.active;

  await db.payrollProfile.update({ where: { id: profileId }, data: updateData });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "PAYROLL_PROFILE_UPDATED", entityType: "PayrollProfile", entityId: profileId });
  revalidatePath("/hr/payroll-profiles");
  revalidatePath(`/hr/payroll-profiles/${profile.employeeId}`);
  revalidatePath(`/employees/${profile.employeeId}`);
  return { ok: true };
}

export async function deactivatePayrollProfileAction(profileId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_PAYROLL")) return { ok: false, error: "Permission denied" };

  const profile = await db.payrollProfile.findFirst({ where: { id: profileId, companyId: s.tenantId } });
  if (!profile) return { ok: false, error: "Payroll profile not found" };
  if (!profile.active) return { ok: false, error: "Profile already deactivated" };

  await db.payrollProfile.update({ where: { id: profileId }, data: { active: false } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "PAYROLL_PROFILE_DEACTIVATED", entityType: "PayrollProfile", entityId: profileId });
  revalidatePath("/hr/payroll-profiles");
  revalidatePath(`/hr/payroll-profiles/${profile.employeeId}`);
  revalidatePath(`/employees/${profile.employeeId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────
// HR-5: PAYROLL RUNS
// ─────────────────────────────────────────────

const payrollRunSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2050),
  notes: z.string().optional(),
});

export async function createPayrollRunAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_PAYROLL")) return { ok: false, error: "Permission denied" };
  if (s.role === "BRANCH_MANAGER") return { ok: false, error: "Branch Manager cannot create payroll runs" };

  const parsed = payrollRunSchema.safeParse({
    month: formData.get("month"),
    year: formData.get("year"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  try {
    const { generatePayrollRun } = await import("@/lib/hr/payroll");
    const result = await generatePayrollRun({
      companyId: s.tenantId,
      month: parsed.data.month,
      year: parsed.data.year,
      createdById: s.userId,
      notes: parsed.data.notes,
    });

    await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "PAYROLL_RUN_CREATED", entityType: "PayrollRun", entityId: result.runId, reason: `${parsed.data.month}/${parsed.data.year} — ${result.linesCreated} lines` });
    revalidatePath("/hr/payroll-runs");
    revalidatePath(`/hr/payroll-runs/${result.runId}`);
    return { ok: true, id: result.runId, warnings: result.warnings, missingProfiles: result.missingProfileEmployeeIds.length };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function generatePayrollLinesAction(runId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_PAYROLL")) return { ok: false, error: "Permission denied" };

  const run = await db.payrollRun.findFirst({ where: { id: runId, companyId: s.tenantId } });
  if (!run) return { ok: false, error: "Payroll run not found" };
  if (run.status !== "DRAFT") return { ok: false, error: "Lines can only be generated for DRAFT runs" };

  const existingLines = await db.payrollRunLine.count({ where: { payrollRunId: runId } });
  if (existingLines > 0) return { ok: false, error: "Lines already exist. Recalculate instead." };

  try {
    const { generatePayrollRun } = await import("@/lib/hr/payroll");
    const result = await generatePayrollRun({
      companyId: s.tenantId,
      month: run.month,
      year: run.year,
      createdById: s.userId,
      notes: run.notes ?? undefined,
    });

    await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "PAYROLL_RUN_GENERATED", entityType: "PayrollRun", entityId: runId, reason: `${result.linesCreated} lines generated` });
    revalidatePath("/hr/payroll-runs");
    revalidatePath(`/hr/payroll-runs/${runId}`);
    return { ok: true, warnings: result.warnings, missingProfiles: result.missingProfileEmployeeIds.length };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function recalculatePayrollRunAction(runId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_PAYROLL")) return { ok: false, error: "Permission denied" };

  const run = await db.payrollRun.findFirst({ where: { id: runId, companyId: s.tenantId } });
  if (!run) return { ok: false, error: "Payroll run not found" };
  if (run.status === "LOCKED") return { ok: false, error: "Cannot recalculate a locked payroll run" };
  if (run.status === "CANCELLED") return { ok: false, error: "Cannot recalculate a cancelled payroll run" };

  const lines = await db.payrollRunLine.findMany({ where: { payrollRunId: runId } });
  const { recalculateSingleLine } = await import("@/lib/hr/payroll");

  let recalculated = 0;
  for (const line of lines) {
    const result = await recalculateSingleLine(line.id, s.tenantId);
    if (result.ok) recalculated++;
  }

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "PAYROLL_RUN_RECALCULATED", entityType: "PayrollRun", entityId: runId, reason: `${recalculated} lines recalculated` });
  revalidatePath("/hr/payroll-runs");
  revalidatePath(`/hr/payroll-runs/${runId}`);
  return { ok: true, recalculated };
}

export async function movePayrollRunToReviewAction(runId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_PAYROLL")) return { ok: false, error: "Permission denied" };

  const run = await db.payrollRun.findFirst({ where: { id: runId, companyId: s.tenantId } });
  if (!run) return { ok: false, error: "Payroll run not found" };
  if (run.status !== "DRAFT") return { ok: false, error: "Only DRAFT runs can be moved to REVIEW" };

  const lineCount = await db.payrollRunLine.count({ where: { payrollRunId: runId } });
  if (lineCount === 0) return { ok: false, error: "Generate payroll lines before moving to review" };

  await db.payrollRun.update({ where: { id: runId }, data: { status: "REVIEW" } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "PAYROLL_RUN_MOVED_TO_REVIEW", entityType: "PayrollRun", entityId: runId });
  revalidatePath("/hr/payroll-runs");
  revalidatePath(`/hr/payroll-runs/${runId}`);
  return { ok: true };
}

export async function approvePayrollRunAction(runId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_PAYROLL")) return { ok: false, error: "Permission denied" };

  const run = await db.payrollRun.findFirst({ where: { id: runId, companyId: s.tenantId } });
  if (!run) return { ok: false, error: "Payroll run not found" };
  if (run.status !== "REVIEW") return { ok: false, error: "Only REVIEW runs can be approved" };

  await db.payrollRun.update({ where: { id: runId }, data: { status: "APPROVED", approvedById: s.userId, approvedAt: new Date() } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "PAYROLL_RUN_APPROVED", entityType: "PayrollRun", entityId: runId });
  revalidatePath("/hr/payroll-runs");
  revalidatePath(`/hr/payroll-runs/${runId}`);
  return { ok: true };
}

export interface PayrollLockReadiness {
  ready: boolean;
  pendingAdjustments: number;
  pendingApprovalRequests: number;
  attendanceRequiresApproval: number;
  pendingAttendanceStatuses: number;
  pendingLeaveRequests: number;
  missingPayrollProfiles: number;
}

export async function checkPayrollLockReadiness(
  runId: string,
  companyId: string
): Promise<PayrollLockReadiness> {
  const run = await db.payrollRun.findFirst({ where: { id: runId, companyId } });
  if (!run) {
    return {
      ready: false, pendingAdjustments: 0, pendingApprovalRequests: 0,
      attendanceRequiresApproval: 0, pendingAttendanceStatuses: 0,
      pendingLeaveRequests: 0, missingPayrollProfiles: 0,
    };
  }

  const monthStart = new Date(run.year, run.month - 1, 1);
  const monthEnd = new Date(run.year, run.month, 0, 23, 59, 59);

  const lines = await db.payrollRunLine.findMany({
    where: { payrollRunId: runId },
    select: { employeeId: true, notes: true },
  });
  const employeeIds = lines.map((l) => l.employeeId);

  const missingPayrollProfiles = lines.filter(
    (l) => l.notes?.includes("WARNING: No active payroll profile")
  ).length;

  if (employeeIds.length === 0) {
    return {
      ready: true, pendingAdjustments: 0, pendingApprovalRequests: 0,
      attendanceRequiresApproval: 0, pendingAttendanceStatuses: 0,
      pendingLeaveRequests: 0, missingPayrollProfiles: 0,
    };
  }

  const [
    pendingAdjustments,
    pendingApprovalRequests,
    attendanceRequiresApproval,
    pendingAttendanceStatuses,
    pendingLeaveRequests,
  ] = await Promise.all([
    db.payrollAdjustment.count({
      where: { payrollRunId: runId, companyId, status: "PENDING" },
    }),
    db.approvalRequest.count({
      where: {
        companyId,
        employeeId: { in: employeeIds },
        date: { gte: monthStart, lte: monthEnd },
        status: "PENDING",
      },
    }),
    db.attendanceDay.count({
      where: {
        companyId,
        employeeId: { in: employeeIds },
        date: { gte: monthStart, lte: monthEnd },
        requiresApproval: true,
      },
    }),
    db.attendanceDay.count({
      where: {
        companyId,
        employeeId: { in: employeeIds },
        date: { gte: monthStart, lte: monthEnd },
        status: { in: ["PENDING_APPROVAL", "MISSING_CLOCK_OUT", "NO_SCHEDULE"] },
      },
    }),
    db.leaveRequest.count({
      where: {
        companyId,
        employeeId: { in: employeeIds },
        status: "PENDING",
        OR: [
          { startDate: { lte: monthEnd }, endDate: { gte: monthStart } },
        ],
      },
    }),
  ]);

  const ready =
    pendingAdjustments === 0 &&
    pendingApprovalRequests === 0 &&
    attendanceRequiresApproval === 0 &&
    pendingAttendanceStatuses === 0 &&
    pendingLeaveRequests === 0 &&
    missingPayrollProfiles === 0;

  return {
    ready,
    pendingAdjustments,
    pendingApprovalRequests,
    attendanceRequiresApproval,
    pendingAttendanceStatuses,
    pendingLeaveRequests,
    missingPayrollProfiles,
  };
}

export async function lockPayrollRunAction(runId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_PAYROLL")) return { ok: false, error: "Permission denied" };

  const run = await db.payrollRun.findFirst({ where: { id: runId, companyId: s.tenantId } });
  if (!run) return { ok: false, error: "Payroll run not found" };
  if (run.status !== "APPROVED") return { ok: false, error: "Only APPROVED runs can be locked" };

  const readiness = await checkPayrollLockReadiness(runId, s.tenantId);
  if (!readiness.ready) {
    const parts: string[] = [];
    if (readiness.pendingAdjustments > 0) parts.push(`${readiness.pendingAdjustments} pending adjustment(s)`);
    if (readiness.pendingApprovalRequests > 0) parts.push(`${readiness.pendingApprovalRequests} pending approval request(s)`);
    if (readiness.attendanceRequiresApproval > 0) parts.push(`${readiness.attendanceRequiresApproval} attendance record(s) requiring approval`);
    if (readiness.pendingAttendanceStatuses > 0) parts.push(`${readiness.pendingAttendanceStatuses} missing clock-out / no-schedule record(s)`);
    if (readiness.pendingLeaveRequests > 0) parts.push(`${readiness.pendingLeaveRequests} pending leave request(s)`);
    if (readiness.missingPayrollProfiles > 0) parts.push(`${readiness.missingPayrollProfiles} missing payroll profile(s)`);
    return {
      ok: false,
      error: `Cannot lock payroll run. Please resolve: ${parts.join("; ")}.`,
    };
  }

  await db.payrollRun.update({ where: { id: runId }, data: { status: "LOCKED", lockedAt: new Date() } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "PAYROLL_RUN_LOCKED", entityType: "PayrollRun", entityId: runId });
  revalidatePath("/hr/payroll-runs");
  revalidatePath(`/hr/payroll-runs/${runId}`);
  return { ok: true };
}

export async function cancelPayrollRunAction(runId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_PAYROLL")) return { ok: false, error: "Permission denied" };

  const run = await db.payrollRun.findFirst({ where: { id: runId, companyId: s.tenantId } });
  if (!run) return { ok: false, error: "Payroll run not found" };
  if (run.status === "LOCKED") return { ok: false, error: "Cannot cancel a locked payroll run" };
  if (run.status === "CANCELLED") return { ok: false, error: "Run already cancelled" };

  await db.payrollRun.update({ where: { id: runId }, data: { status: "CANCELLED" } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "PAYROLL_RUN_CANCELLED", entityType: "PayrollRun", entityId: runId });
  revalidatePath("/hr/payroll-runs");
  revalidatePath(`/hr/payroll-runs/${runId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────
// HR-5: PAYROLL ADJUSTMENTS
// ─────────────────────────────────────────────

const payrollAdjustmentSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  payrollRunId: z.string().optional(),
  type: z.enum(["BONUS", "DEDUCTION", "ALLOWANCE", "PENALTY", "OVERTIME_ADJUSTMENT", "MANUAL_CORRECTION"]),
  amount: z.coerce.number().int().min(1, "Amount must be positive"),
  reason: z.string().min(1, "Reason is required"),
});

export async function createPayrollAdjustmentAction(prev: any, formData: FormData) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_PAYROLL")) return { ok: false, error: "Permission denied" };

  const parsed = payrollAdjustmentSchema.safeParse({
    employeeId: formData.get("employeeId"),
    payrollRunId: formData.get("payrollRunId") || undefined,
    type: formData.get("type"),
    amount: formData.get("amount"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  if (parsed.data.payrollRunId) {
    const run = await db.payrollRun.findFirst({ where: { id: parsed.data.payrollRunId, companyId: s.tenantId } });
    if (!run) return { ok: false, error: "Payroll run not found" };
    if (run.status === "LOCKED") return { ok: false, error: "Cannot add adjustments to a locked payroll run" };
  }

  const adjustment = await db.payrollAdjustment.create({
    data: {
      companyId: s.tenantId,
      employeeId: parsed.data.employeeId,
      payrollRunId: parsed.data.payrollRunId || null,
      type: parsed.data.type as any,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      createdById: s.userId,
      status: "PENDING",
    },
  });

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "PAYROLL_ADJUSTMENT_CREATED", entityType: "PayrollAdjustment", entityId: adjustment.id, reason: `${parsed.data.type} ${parsed.data.amount} — ${parsed.data.reason}` });
  revalidatePath("/hr/payroll-runs");
  if (parsed.data.payrollRunId) revalidatePath(`/hr/payroll-runs/${parsed.data.payrollRunId}`);
  revalidatePath(`/employees/${parsed.data.employeeId}`);
  return { ok: true, id: adjustment.id };
}

export async function approvePayrollAdjustmentAction(adjustmentId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_PAYROLL")) return { ok: false, error: "Permission denied" };

  const adj = await db.payrollAdjustment.findFirst({ where: { id: adjustmentId, companyId: s.tenantId } });
  if (!adj) return { ok: false, error: "Adjustment not found" };
  if (adj.status !== "PENDING") return { ok: false, error: "Only pending adjustments can be approved" };

  if (adj.payrollRunId) {
    const run = await db.payrollRun.findFirst({ where: { id: adj.payrollRunId, companyId: s.tenantId } });
    if (run?.status === "LOCKED") return { ok: false, error: "Cannot approve adjustment on a locked payroll run" };
  }

  await db.payrollAdjustment.update({ where: { id: adjustmentId }, data: { status: "APPROVED", approvedById: s.userId } });

  if (adj.payrollRunId) {
    const { recalculateSingleLine } = await import("@/lib/hr/payroll");
    const line = await db.payrollRunLine.findFirst({
      where: { payrollRunId: adj.payrollRunId, employeeId: adj.employeeId },
    });
    if (line) await recalculateSingleLine(line.id, s.tenantId);
  }

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "PAYROLL_ADJUSTMENT_APPROVED", entityType: "PayrollAdjustment", entityId: adjustmentId });
  revalidatePath("/hr/payroll-runs");
  if (adj.payrollRunId) revalidatePath(`/hr/payroll-runs/${adj.payrollRunId}`);
  revalidatePath(`/employees/${adj.employeeId}`);
  return { ok: true };
}

export async function rejectPayrollAdjustmentAction(adjustmentId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_PAYROLL")) return { ok: false, error: "Permission denied" };

  const adj = await db.payrollAdjustment.findFirst({ where: { id: adjustmentId, companyId: s.tenantId } });
  if (!adj) return { ok: false, error: "Adjustment not found" };
  if (adj.status !== "PENDING") return { ok: false, error: "Only pending adjustments can be rejected" };

  if (adj.payrollRunId) {
    const run = await db.payrollRun.findFirst({ where: { id: adj.payrollRunId, companyId: s.tenantId } });
    if (run?.status === "LOCKED") return { ok: false, error: "Cannot reject adjustment on a locked payroll run" };
  }

  await db.payrollAdjustment.update({ where: { id: adjustmentId }, data: { status: "REJECTED", approvedById: s.userId } });

  if (adj.payrollRunId) {
    const { recalculateSingleLine } = await import("@/lib/hr/payroll");
    const line = await db.payrollRunLine.findFirst({
      where: { payrollRunId: adj.payrollRunId, employeeId: adj.employeeId },
    });
    if (line) await recalculateSingleLine(line.id, s.tenantId);
  }

  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "PAYROLL_ADJUSTMENT_REJECTED", entityType: "PayrollAdjustment", entityId: adjustmentId });
  revalidatePath("/hr/payroll-runs");
  if (adj.payrollRunId) revalidatePath(`/hr/payroll-runs/${adj.payrollRunId}`);
  revalidatePath(`/employees/${adj.employeeId}`);
  return { ok: true };
}

export async function cancelPayrollAdjustmentAction(adjustmentId: string) {
  const s = await requireHrSession();
  if (!hasPermission(s.role, "MANAGE_PAYROLL")) return { ok: false, error: "Permission denied" };

  const adj = await db.payrollAdjustment.findFirst({ where: { id: adjustmentId, companyId: s.tenantId } });
  if (!adj) return { ok: false, error: "Adjustment not found" };
  if (adj.status !== "PENDING") return { ok: false, error: "Only pending adjustments can be cancelled" };

  if (adj.payrollRunId) {
    const run = await db.payrollRun.findFirst({ where: { id: adj.payrollRunId, companyId: s.tenantId } });
    if (run?.status === "LOCKED") return { ok: false, error: "Cannot cancel adjustment on a locked payroll run" };
  }

  await db.payrollAdjustment.update({ where: { id: adjustmentId }, data: { status: "CANCELLED" } });
  await logTenantEvent({ companyId: s.tenantId, actorId: s.userId, actorEmail: s.email, action: "PAYROLL_ADJUSTMENT_CANCELLED", entityType: "PayrollAdjustment", entityId: adjustmentId });
  revalidatePath("/hr/payroll-runs");
  if (adj.payrollRunId) revalidatePath(`/hr/payroll-runs/${adj.payrollRunId}`);
  revalidatePath(`/employees/${adj.employeeId}`);
  return { ok: true };
}
