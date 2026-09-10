import fs from "node:fs";

function replaceExact(file, from, to) {
  const current = fs.readFileSync(file, "utf8");
  if (current.includes(to)) return false;
  if (!current.includes(from)) throw new Error(`Patch anchor not found in ${file}: ${from.slice(0, 120)}`);
  fs.writeFileSync(file, current.replace(from, to));
  return true;
}

function updateJson(file, updater) {
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  updater(value);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

// 1) Mobile-web and kiosk: tenant policy + normalized evidence.
const clockFile = "src/app/(tenant)/clock/actions.ts";
replaceExact(
  clockFile,
  `import { assessAttendanceTrust } from "@/lib/attendance/trust-engine";\nimport { validateKioskDevice, verifyKioskCredentials, KIOSK_DEVICE_ERROR } from "@/lib/kiosk/kiosk-auth";`,
  `import { assessAttendanceTrust } from "@/lib/attendance/trust-engine";\nimport { attendanceTrustPolicyFromSettings } from "@/lib/attendance/trust-policy";\nimport { persistAttendanceTrustAssessment } from "@/lib/attendance/trust-persistence";\nimport { validateKioskDevice, verifyKioskCredentials, KIOSK_DEVICE_ERROR } from "@/lib/kiosk/kiosk-auth";`,
);
replaceExact(
  clockFile,
  `    const schedule = await db.schedule.findUnique({\n      where: { companyId_employeeId_date: { companyId: employee.companyId, employeeId: employee.id, date: today } },\n    });`,
  `    const [schedule, settings] = await Promise.all([\n      db.schedule.findUnique({\n        where: { companyId_employeeId_date: { companyId: employee.companyId, employeeId: employee.id, date: today } },\n      }),\n      db.companySettings.findUnique({ where: { companyId: employee.companyId } }),\n    ]);`,
);
replaceExact(
  clockFile,
  `    const trust = assessAttendanceTrust({\n      source: d.source,\n      insideGeofence,\n      distanceMeters,\n      accuracyMeters: d.source === "MOBILE_WEB" ? (d.accuracyMeters ?? null) : null,\n      deviceTrusted: d.source === "KIOSK" ? true : null,\n    });\n    const needsApproval = !insideGeofence || trust.decision !== "ACCEPT";`,
  `    const trustPolicy = attendanceTrustPolicyFromSettings(settings);\n    const trust = assessAttendanceTrust({\n      source: d.source,\n      insideGeofence,\n      distanceMeters,\n      accuracyMeters: d.source === "MOBILE_WEB" ? (d.accuracyMeters ?? null) : null,\n      deviceTrusted: d.source === "KIOSK" ? true : null,\n    }, trustPolicy);\n    const geofenceReviewRequired = !insideGeofence && (settings?.requireApprovalOutsideGeofence ?? true);\n    const needsApproval = trust.decision === "REVIEW" || geofenceReviewRequired;\n    const punchStatus = trust.decision === "REJECT"\n      ? "REJECTED" as const\n      : needsApproval\n        ? "NEEDS_APPROVAL" as const\n        : "ACCEPTED" as const;`,
);
replaceExact(
  clockFile,
  `          status: needsApproval ? "NEEDS_APPROVAL" : "ACCEPTED",`,
  `          status: punchStatus,`,
);
replaceExact(
  clockFile,
  `      if (needsApproval) {\n        await tx.approvalRequest.create({`,
  `      await persistAttendanceTrustAssessment(tx, {\n        companyId: employee.companyId,\n        punchId: created.id,\n        source: d.source,\n        assessment: trust,\n        reviewStatus: punchStatus === "NEEDS_APPROVAL" ? "PENDING" : "NOT_REQUIRED",\n      });\n\n      if (punchStatus === "NEEDS_APPROVAL") {\n        await tx.approvalRequest.create({`,
);
replaceExact(
  clockFile,
  `        approvalCreated: needsApproval,`,
  `        approvalCreated: punchStatus === "NEEDS_APPROVAL",`,
);
replaceExact(
  clockFile,
  `      approvalRequired: needsApproval,`,
  `      approvalRequired: punchStatus === "NEEDS_APPROVAL",`,
);

// 2) Approval decision closes the normalized review record as well as the punch.
const approvalsFile = "src/app/(tenant)/approvals/actions.ts";
replaceExact(
  approvalsFile,
  `        await db.punch.update({\n          where: { id: relatedPunch.id },\n          data: { status: decision === "APPROVED" ? "ACCEPTED" : "REJECTED" },\n        });\n        await recalculateAttendanceDay({ employeeId: req.employeeId, date: dayStart });`,
  `        await db.$transaction([\n          db.punch.update({\n            where: { id: relatedPunch.id },\n            data: { status: decision === "APPROVED" ? "ACCEPTED" : "REJECTED" },\n          }),\n          db.attendanceTrustAssessment.updateMany({\n            where: { companyId: s.tenantId, punchId: relatedPunch.id },\n            data: {\n              reviewStatus: decision === "APPROVED" ? "APPROVED" : "REJECTED",\n              reviewedById: s.sub,\n              reviewedAt: new Date(),\n              reviewNotes: managerNotes ?? null,\n            },\n          }),\n        ]);\n        await recalculateAttendanceDay({ employeeId: req.employeeId, date: dayStart });`,
);

// 3) Attendance day should not remain outside-geofence because a fraudulent punch was rejected.
replaceExact(
  "src/lib/attendance/engine.ts",
  `    const outsideGeofence = punches.some((p) => p.insideGeofence === false);`,
  `    const outsideGeofence = punches.some((p) => p.insideGeofence === false && p.status !== "REJECTED");`,
);

// 4) Live operations consumes normalized evidence first, with legacy JSON fallback.
const liveFile = "src/app/(tenant)/live/page.tsx";
replaceExact(
  liveFile,
  `      include: { employee: true, branch: true },`,
  `      include: { employee: true, branch: true, trustAssessment: true },`,
);
replaceExact(
  liveFile,
  `                  const trust = parseStoredTrust(p.deviceInfo);`,
  `                  const trust = p.trustAssessment\n                    ? { score: p.trustAssessment.score, riskLevel: p.trustAssessment.riskLevel, decision: p.trustAssessment.decision }\n                    : parseStoredTrust(p.deviceInfo);`,
);

// 5) Tenant policy settings: thresholds, critical blocking and retention.
const settingsAction = "src/app/(tenant)/settings/actions.ts";
replaceExact(
  settingsAction,
  `  whatsappNotifications: z.enum(["true", "false"]).or(z.boolean()),\n});`,
  `  whatsappNotifications: z.enum(["true", "false"]).or(z.boolean()),\n  trustReviewBelow: z.coerce.number().int().min(1).max(100),\n  trustRejectBelow: z.coerce.number().int().min(0).max(99),\n  trustBlockCriticalRisk: z.enum(["true", "false"]).or(z.boolean()),\n  biometricRetentionHours: z.coerce.number().int().min(1).max(168),\n});`,
);
replaceExact(
  settingsAction,
  `      whatsappNotifications: formData.get("whatsappNotifications") ?? "false",\n    });\n    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };\n    const d: any = parsed.data;`,
  `      whatsappNotifications: formData.get("whatsappNotifications") ?? "false",\n      trustReviewBelow: formData.get("trustReviewBelow") ?? "75",\n      trustRejectBelow: formData.get("trustRejectBelow") ?? "30",\n      trustBlockCriticalRisk: formData.get("trustBlockCriticalRisk") ?? "false",\n      biometricRetentionHours: formData.get("biometricRetentionHours") ?? "24",\n    });\n    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };\n    if (parsed.data.trustRejectBelow >= parsed.data.trustReviewBelow) {\n      return { ok: false, error: "Trust reject threshold must be lower than the review threshold" };\n    }\n    const d: any = parsed.data;`,
);
replaceExact(
  settingsAction,
  `for (const k of ["enableMobileClock", "enableKioskClock", "requireApprovalOutsideGeofence", "requireApprovalOvertime", "allowNoScheduleClockIn", "allowManualRequests", "enableEmployeeSelfService", "enableBranchManagerApprovals", "emailNotifications", "whatsappNotifications"])`,
  `for (const k of ["enableMobileClock", "enableKioskClock", "requireApprovalOutsideGeofence", "requireApprovalOvertime", "allowNoScheduleClockIn", "allowManualRequests", "enableEmployeeSelfService", "enableBranchManagerApprovals", "emailNotifications", "whatsappNotifications", "trustBlockCriticalRisk"])`,
);

const settingsForm = "src/app/(tenant)/settings/CustomerSettingsForm.tsx";
replaceExact(
  settingsForm,
  `        <div><Label htmlFor="defaultOvertimeThresholdMinutes">{t("overtimeThreshold")}</Label><Input id="defaultOvertimeThresholdMinutes" name="defaultOvertimeThresholdMinutes" type="number" min={0} max={1440} defaultValue={s.defaultOvertimeThresholdMinutes ?? 480} /></div>\n      </div>`,
  `        <div><Label htmlFor="defaultOvertimeThresholdMinutes">{t("overtimeThreshold")}</Label><Input id="defaultOvertimeThresholdMinutes" name="defaultOvertimeThresholdMinutes" type="number" min={0} max={1440} defaultValue={s.defaultOvertimeThresholdMinutes ?? 480} /></div>\n        <div><Label htmlFor="trustReviewBelow">{t("trustReviewBelow")}</Label><Input id="trustReviewBelow" name="trustReviewBelow" type="number" min={1} max={100} defaultValue={s.trustReviewBelow ?? 75} /></div>\n        <div><Label htmlFor="trustRejectBelow">{t("trustRejectBelow")}</Label><Input id="trustRejectBelow" name="trustRejectBelow" type="number" min={0} max={99} defaultValue={s.trustRejectBelow ?? 30} /></div>\n        <div><Label htmlFor="biometricRetentionHours">{t("biometricRetentionHours")}</Label><Input id="biometricRetentionHours" name="biometricRetentionHours" type="number" min={1} max={168} defaultValue={s.biometricRetentionHours ?? 24} /></div>\n      </div>`,
);
replaceExact(
  settingsForm,
  `          { key: "enableBranchManagerApprovals", label: t("enableBranchManagerApprovals"), def: true },`,
  `          { key: "enableBranchManagerApprovals", label: t("enableBranchManagerApprovals"), def: true },\n          { key: "trustBlockCriticalRisk", label: t("trustBlockCriticalRisk"), def: false },`,
);
replaceExact(
  settingsForm,
  `      {state.error && <p className="text-xs text-destructive">{state.error}</p>}`,
  `      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">\n        {t("trustProviderNotice")}\n      </div>\n\n      {state.error && <p className="text-xs text-destructive">{state.error}</p>}`,
);

for (const [file, values] of [
  ["messages/en.json", {
    trustReviewBelow: "Review punches below trust score",
    trustRejectBelow: "Reject threshold (strict mode)",
    biometricRetentionHours: "Biometric evidence retention (hours)",
    trustBlockCriticalRisk: "Block critical-risk attendance automatically",
    trustProviderNotice: "Face and liveness requirements stay disabled until a verified biometric provider is connected. Current policy uses server-verifiable location and device evidence only.",
  }],
  ["messages/ar.json", {
    trustReviewBelow: "مراجعة البصمات الأقل من درجة الثقة",
    trustRejectBelow: "حد الرفض في الوضع الصارم",
    biometricRetentionHours: "مدة الاحتفاظ بأدلة القياسات الحيوية بالساعات",
    trustBlockCriticalRisk: "رفض بصمات المخاطر الحرجة تلقائيًا",
    trustProviderNotice: "متطلبات مطابقة الوجه والتحقق من الحيوية ستظل معطلة حتى يتم ربط مزود قياسات حيوية موثوق. السياسة الحالية تعتمد فقط على أدلة الموقع والجهاز التي يتحقق منها الخادم.",
  }],
]) {
  updateJson(file, (value) => Object.assign(value.settings, values));
}

// 6) Unit policy tests.
fs.writeFileSync("tests/trust-policy.test.ts", `import { describe, expect, it } from "vitest";\nimport { attendanceTrustPolicyFromSettings } from "@/lib/attendance/trust-policy";\n\ndescribe("tenant attendance trust policy", () => {\n  it("uses safe defaults without company settings", () => {\n    const policy = attendanceTrustPolicyFromSettings(null);\n    expect(policy.reviewBelow).toBe(75);\n    expect(policy.rejectBelow).toBe(30);\n    expect(policy.blockCriticalRisk).toBe(false);\n    expect(policy.requireFace).toBe(false);\n    expect(policy.requireLiveness).toBe(false);\n  });\n\n  it("materializes tenant thresholds into a versioned policy", () => {\n    const policy = attendanceTrustPolicyFromSettings({\n      trustPolicyVersion: "ops-v2",\n      trustReviewBelow: 82,\n      trustRejectBelow: 25,\n      trustBlockCriticalRisk: true,\n      trustRequireFace: false,\n      trustRequireLiveness: false,\n    } as any);\n    expect(policy.reviewBelow).toBe(82);\n    expect(policy.rejectBelow).toBe(25);\n    expect(policy.blockCriticalRisk).toBe(true);\n    expect(policy.version).toContain("ops-v2:review-82:reject-25:critical-1");\n  });\n});\n`);

// 7) Runtime: create a real trust assessment and verify manager review closes it.
const trustRuntime = "tests/runtime/trust-approval.test.ts";
replaceExact(
  trustRuntime,
  `  const request = await db.approvalRequest.create({`,
  `  await db.attendanceTrustAssessment.create({\n    data: {\n      companyId: tenantId,\n      punchId: punch.id,\n      policyVersion: "trust-v1.0",\n      score: 62,\n      riskLevel: "MEDIUM",\n      decision: "REVIEW",\n      criticalRisk: false,\n      source: "MOBILE_APP",\n      signalsJson: "[]",\n      reasonsJson: "[]",\n      reviewStatus: "PENDING",\n    },\n  });\n  const request = await db.approvalRequest.create({`,
);
replaceExact(
  trustRuntime,
  `    expect(updatedPunch?.status).toBe("ACCEPTED");\n    expect(updatedRequest?.status).toBe("APPROVED");`,
  `    const assessment = await db.attendanceTrustAssessment.findUnique({ where: { punchId: punch.id } });\n    expect(updatedPunch?.status).toBe("ACCEPTED");\n    expect(updatedRequest?.status).toBe("APPROVED");\n    expect(assessment?.reviewStatus).toBe("APPROVED");\n    expect(assessment?.reviewedById).toBe(managerUserId);`,
);
replaceExact(
  trustRuntime,
  `    expect(updatedPunch?.status).toBe("REJECTED");\n    expect(updatedRequest?.status).toBe("REJECTED");`,
  `    const assessment = await db.attendanceTrustAssessment.findUnique({ where: { punchId: punch.id } });\n    expect(updatedPunch?.status).toBe("REJECTED");\n    expect(updatedRequest?.status).toBe("REJECTED");\n    expect(assessment?.reviewStatus).toBe("REJECTED");\n    expect(assessment?.reviewNotes).toBe("Risk evidence not accepted");`,
);

console.log("Attendance Trust v2 integration patch applied.");
