"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  onboardingStep1Action,
  onboardingCreateBranchAction,
  onboardingCreateDepartmentsAction,
  onboardingCreatePolicyAction,
  createEmployeeAction,
  bulkScheduleAction,
} from "../actions";
import { Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import type { Branch, Department, Employee, ShiftPolicy, Tenant, CompanySettings } from "@prisma/client";

export function OnboardingWizard({
  tenant, settings, branches, departments, policies, employees,
}: {
  tenant: Tenant;
  settings: CompanySettings | null;
  branches: Branch[];
  departments: Department[];
  policies: ShiftPolicy[];
  employees: Employee[];
}) {
  const t = useTranslations("onboarding");
  const [tab, setTab] = useState("profile");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">{t("wizardTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
          {[
            { key: "profile", label: t("tabProfile") },
            { key: "branch", label: t("tabBranch") },
            { key: "departments", label: t("tabDepartments") },
            { key: "policies", label: t("tabPolicies") },
            { key: "employees", label: t("tabEmployees") },
            { key: "schedules", label: t("tabSchedules") },
            { key: "review", label: t("tabReview") },
          ].map((tabItem) => (
            <button key={tabItem.key} onClick={() => setTab(tabItem.key)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${tab === tabItem.key ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-muted"}`}>
              {tabItem.label}
            </button>
          ))}
        </div>
        <div className="pt-4">
          {tab === "profile" && <Step1Profile settings={settings} tenant={tenant} />}
          {tab === "branch" && <Step2Branch branches={branches} />}
          {tab === "departments" && <Step3Departments departments={departments} />}
          {tab === "policies" && <Step4Policies policies={policies} />}
          {tab === "employees" && <Step5Employees branches={branches} departments={departments} policies={policies} employees={employees} />}
          {tab === "schedules" && <Step6Schedules branches={branches} policies={policies} employees={employees} />}
          {tab === "review" && <Step7Review branches={branches} departments={departments} policies={policies} employees={employees} />}
        </div>
      </CardContent>
    </Card>
  );
}

function Step1Profile({ settings, tenant }: { settings: CompanySettings | null; tenant: Tenant }) {
  const t = useTranslations("onboarding");
  const [state, setState] = useState<{ ok?: boolean; error?: string }>({});
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function onSubmit(fd: FormData) {
    setPending(true);
    const r = await onboardingStep1Action({}, fd);
    setState(r);
    setPending(false);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>{t("companyNameLabel")}</Label>
          <Input value={tenant.name} disabled />
        </div>
        <div>
          <Label htmlFor="industry">{t("industryLabel")}</Label>
          <Input id="industry" name="industry" defaultValue={settings?.industry ?? ""} placeholder={t("industryPlaceholder")} />
        </div>
        <div>
          <Label htmlFor="timezone">{t("timezoneLabel")}</Label>
          <Input id="timezone" name="timezone" defaultValue={settings?.timezone ?? "Africa/Cairo"} />
        </div>
        <div>
          <Label htmlFor="currency">{t("currencyLabel")}</Label>
          <Input id="currency" name="currency" defaultValue={settings?.currency ?? "EGP"} />
        </div>
        <div>
          <Label htmlFor="defaultLanguage">{t("defaultLanguageLabel")}</Label>
          <Select name="defaultLanguage" defaultValue={settings?.defaultLanguage ?? "en"}>
            <SelectTrigger id="defaultLanguage"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ar">Arabic</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.ok && <p className="text-xs text-brand-success">{t("profileSaved")}</p>}
      <Button type="submit" size="sm" disabled={pending}>{pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} {t("saveProfile")}</Button>
    </form>
  );
}

function Step2Branch({ branches }: { branches: Branch[] }) {
  const t = useTranslations("onboarding");
  return (
    <div className="space-y-3">
      {branches.length > 0 && (
        <div className="space-y-1.5">
          {branches.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
              <span className="font-medium text-foreground">{b.name}</span>
              <span className="text-xs text-muted-foreground">{b.code} · {b.city ?? "—"}</span>
            </div>
          ))}
        </div>
      )}
      <form action={onboardingCreateBranchAction as any} className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="name">{t("branchNameLabel")}</Label><Input id="name" name="name" required placeholder={t("branchNamePlaceholder")} /></div>
        <div><Label htmlFor="code">{t("codeLabel")}</Label><Input id="code" name="code" required placeholder={t("codePlaceholder")} /></div>
        <div><Label htmlFor="address">{t("addressLabel")}</Label><Input id="address" name="address" placeholder={t("addressPlaceholder")} /></div>
        <div><Label htmlFor="city">{t("cityLabel")}</Label><Input id="city" name="city" placeholder={t("cityPlaceholder")} /></div>
        <div><Label htmlFor="latitude">{t("latitudeLabel")}</Label><Input id="latitude" name="latitude" type="number" step="any" placeholder={t("latitudePlaceholder")} /></div>
        <div><Label htmlFor="longitude">{t("longitudeLabel")}</Label><Input id="longitude" name="longitude" type="number" step="any" placeholder={t("longitudePlaceholder")} /></div>
        <div><Label htmlFor="geofenceRadius">{t("geofenceRadiusLabel")}</Label><Input id="geofenceRadius" name="geofenceRadius" type="number" min={50} max={2000} defaultValue={150} /></div>
        <div className="sm:col-span-2"><Button type="submit" size="sm">{t("addBranch")}</Button></div>
      </form>
    </div>
  );
}

function Step3Departments({ departments }: { departments: Department[] }) {
  const t = useTranslations("onboarding");
  return (
    <div className="space-y-3">
      {departments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {departments.map((d) => (
            <span key={d.id} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground">{d.name}</span>
          ))}
        </div>
      )}
      <form action={onboardingCreateDepartmentsAction as any} className="space-y-3">
        <div>
          <Label htmlFor="names">{t("departmentsLabel")}</Label>
          <Input id="names" name="names" placeholder={t("departmentsPlaceholder")} />
        </div>
        <Button type="submit" size="sm">{t("createDepartments")}</Button>
      </form>
    </div>
  );
}

function Step4Policies({ policies }: { policies: ShiftPolicy[] }) {
  const t = useTranslations("onboarding");
  return (
    <div className="space-y-3">
      {policies.length > 0 && (
        <div className="space-y-1.5">
          {policies.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
              <span className="font-medium text-foreground">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.startTime} → {p.endTime}</span>
            </div>
          ))}
        </div>
      )}
      <form action={onboardingCreatePolicyAction as any} className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="name">{t("policyNameLabel")}</Label><Input id="name" name="name" required placeholder={t("policyNamePlaceholder")} /></div>
        <div><Label htmlFor="startTime">{t("startTimeLabel")}</Label><Input id="startTime" name="startTime" type="time" required defaultValue="08:00" /></div>
        <div><Label htmlFor="endTime">{t("endTimeLabel")}</Label><Input id="endTime" name="endTime" type="time" required defaultValue="16:00" /></div>
        <div><Label htmlFor="breakMinutes">{t("breakMinLabel")}</Label><Input id="breakMinutes" name="breakMinutes" type="number" min={0} defaultValue={60} /></div>
        <div><Label htmlFor="lateGraceMinutes">{t("lateGraceMinLabel")}</Label><Input id="lateGraceMinutes" name="lateGraceMinutes" type="number" min={0} defaultValue={10} /></div>
        <div><Label htmlFor="earlyLeaveGraceMinutes">{t("earlyLeaveGraceMinLabel")}</Label><Input id="earlyLeaveGraceMinutes" name="earlyLeaveGraceMinutes" type="number" min={0} defaultValue={0} /></div>
        <div><Label htmlFor="overtimeStartsAfterMinutes">{t("overtimeAfterMinLabel")}</Label><Input id="overtimeStartsAfterMinutes" name="overtimeStartsAfterMinutes" type="number" min={0} defaultValue={480} /></div>
        <div className="sm:col-span-2"><Button type="submit" size="sm">{t("createPolicy")}</Button></div>
      </form>
    </div>
  );
}

function Step5Employees({ branches, departments, policies, employees }: { branches: Branch[]; departments: Department[]; policies: ShiftPolicy[]; employees: Employee[] }) {
  const t = useTranslations("onboarding");
  return (
    <div className="space-y-3">
      {employees.length > 0 && <p className="text-sm text-muted-foreground">{t("employeesAdded").replace("{count}", String(employees.length))}</p>}
      <form action={createEmployeeAction as any} className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="employeeCode">{t("employeeCodeLabel")}</Label><Input id="employeeCode" name="employeeCode" required placeholder={t("employeeCodePlaceholder")} /></div>
        <div><Label htmlFor="fullName">{t("fullNameLabel")}</Label><Input id="fullName" name="fullName" required placeholder={t("fullNamePlaceholder")} /></div>
        <div><Label htmlFor="phone">{t("phoneLabel")}</Label><Input id="phone" name="phone" placeholder={t("phonePlaceholder")} /></div>
        <div><Label htmlFor="email">{t("emailLabel")}</Label><Input id="email" name="email" type="email" placeholder={t("emailPlaceholder")} /></div>
        <div><Label htmlFor="jobTitle">{t("jobTitleLabel")}</Label><Input id="jobTitle" name="jobTitle" placeholder={t("jobTitlePlaceholder")} /></div>
        <div>
          <Label htmlFor="branchId">{t("branchLabel")}</Label>
          <Select name="branchId" required>
            <SelectTrigger id="branchId"><SelectValue placeholder={t("selectBranch")} /></SelectTrigger>
            <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="departmentId">{t("departmentLabel")}</Label>
          <Select name="departmentId">
            <SelectTrigger id="departmentId"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="defaultShiftPolicyId">{t("shiftPolicyLabel")}</Label>
          <Select name="defaultShiftPolicyId">
            <SelectTrigger id="defaultShiftPolicyId"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{policies.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label htmlFor="pinCode">{t("pinLabel")}</Label><Input id="pinCode" name="pinCode" placeholder={t("pinPlaceholder")} /></div>
        <div className="sm:col-span-2"><Button type="submit" size="sm">{t("addEmployee")}</Button> <Link href="/employees" className="ml-2 text-xs text-brand-accent hover:underline">{t("goToEmployeeList")}</Link></div>
      </form>
    </div>
  );
}

function Step6Schedules({ branches, policies, employees }: { branches: Branch[]; policies: ShiftPolicy[]; employees: Employee[] }) {
  const t = useTranslations("onboarding");
  const [state, setState] = useState<{ ok?: boolean; error?: string; created?: number; skipped?: number }>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(fd: FormData) {
    setPending(true);
    const r = await bulkScheduleAction({}, fd);
    setState(r);
    setPending(false);
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("schedulesDesc")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="branchId">{t("branchLabel")}</Label>
          <Select name="branchId" required>
            <SelectTrigger id="branchId"><SelectValue placeholder={t("selectBranch")} /></SelectTrigger>
            <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="shiftPolicyId">{t("startTimeLabel")}</Label>
          <Select name="shiftPolicyId" required>
            <SelectTrigger id="shiftPolicyId"><SelectValue placeholder={t("selectBranch")} /></SelectTrigger>
            <SelectContent>{policies.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label htmlFor="dateFrom">{t("dateFrom")}</Label><Input id="dateFrom" name="dateFrom" type="date" required /></div>
        <div><Label htmlFor="dateTo">{t("dateTo")}</Label><Input id="dateTo" name="dateTo" type="date" required /></div>
        <div className="sm:col-span-2">
          <Label>{t("employeesLabel")}</Label>
          <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-card p-2 space-y-1 battend-scroll">
            {employees.length === 0 ? <p className="text-xs text-muted-foreground">{t("noEmployeesHint")}</p> : employees.map((e) => (
              <label key={e.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="employeeIds" value={e.id} className="rounded" />
                <span className="text-foreground">{e.fullName}</span>
                <span className="text-xs text-muted-foreground">{e.employeeCode}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("selectEmployeesHint")}</p>
          <input type="hidden" name="employeeIds" value="" />
        </div>
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.ok && <p className="text-xs text-brand-success">{t("createdSchedules").replace("{created}", String(state.created)).replace("{skipped}", String(state.skipped))}</p>}
      <Button type="submit" size="sm" disabled={pending}>{pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} {t("generateSchedules")}</Button>
    </form>
  );
}

function Step7Review({ branches, departments, policies, employees }: { branches: Branch[]; departments: Department[]; policies: ShiftPolicy[]; employees: Employee[] }) {
  const t = useTranslations("onboarding");
  const steps = [
    { label: t("companyProfile"), done: true },
    { label: t("branchesLabel"), done: branches.length > 0, count: branches.length },
    { label: t("departmentsTitle"), done: departments.length > 0, count: departments.length },
    { label: t("shiftPoliciesLabel"), done: policies.length > 0, count: policies.length },
    { label: t("employeesTitle"), done: employees.length > 0, count: employees.length },
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("setupProgress")}</p>
      <ul className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-3 text-sm">
            {s.done ? <CheckCircle2 className="h-4 w-4 text-brand-success" /> : <div className="h-4 w-4 rounded-full border border-border" />}
            <span className="text-foreground">{s.label}</span>
            {s.count !== undefined && <span className="text-xs text-muted-foreground">{s.count}</span>}
          </li>
        ))}
      </ul>
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
        {t("goToDashboard")}
      </Link>
    </div>
  );
}
