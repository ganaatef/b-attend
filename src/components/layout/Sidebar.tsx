"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarClock,
  Clock,
  TabletSmartphone,
  CheckSquare,
  FileBarChart,
  ScrollText,
  Settings,
  CreditCard,
  LifeBuoy,
  ShieldCheck,
  User as UserIcon,
  CalendarDays,
  ClipboardList,
  Sparkles,
  Brain,
  BookOpen,
  Sunrise,
  Briefcase,
  FileText,
  GraduationCap,
  Package,
  Wallet,
  UserPlus,
  UserMinus,
  AlertTriangle,
  FolderTree,
  Award,
  Shield,
} from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

export interface SidebarUser {
  name: string;
  email: string;
  role: string;
  kind: "platform" | "tenant";
  permissions?: string[];
}

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  badge?: string;
}

const platformNavKeys: NavItem[] = [
  { href: "/admin", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/admin/tenants", labelKey: "tenants", icon: Building2 },
  { href: "/admin/subscriptions", labelKey: "subscriptions", icon: CreditCard },
  { href: "/admin/plans", labelKey: "plans", icon: ShieldCheck },
  { href: "/admin/invoices", labelKey: "invoices", icon: FileBarChart },
  { href: "/admin/leads", labelKey: "leads", icon: Users },
  { href: "/admin/support", labelKey: "support", icon: LifeBuoy },
  { href: "/admin/audit", labelKey: "platformAudit", icon: ScrollText },
  { href: "/admin/ai", labelKey: "aiControls", icon: Brain },
  { href: "/admin/coach-library", labelKey: "coachTips", icon: BookOpen },
  { href: "/admin/settings", labelKey: "adminSettings", icon: Settings },
];

/**
 * Tenant navigation is permission-driven. The legacy role is retained only as a
 * compatibility identity claim; it no longer decides which management screens
 * a custom role can discover.
 */
const tenantManagementNavKeys: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard, permission: "company.view" },
  { href: "/live", labelKey: "liveAttendance", icon: TabletSmartphone, permission: "attendance.team.view" },
  { href: "/branches", labelKey: "branches", icon: Building2, permission: "branches.view" },
  { href: "/employees", labelKey: "employees", icon: Users, permission: "employees.view" },
  { href: "/access", labelKey: "users", icon: ShieldCheck, permission: "users.view" },
  { href: "/policies", labelKey: "shiftPolicies", icon: Clock, permission: "schedules.manage" },
  { href: "/schedules", labelKey: "schedules", icon: CalendarDays, permission: "schedules.team.view" },
  { href: "/kiosk", labelKey: "kiosk", icon: TabletSmartphone, permission: "kiosk.manage" },
  { href: "/approvals", labelKey: "approvals", icon: CheckSquare, permission: "attendance.approve" },
  { href: "/reports", labelKey: "reports", icon: FileBarChart, permission: "reports.view" },
  { href: "/hr", labelKey: "hrDashboard", icon: Briefcase, permission: "employees.view" },
  { href: "/hr/departments", labelKey: "departments", icon: FolderTree, permission: "employees.view" },
  { href: "/hr/job-titles", labelKey: "jobTitles", icon: Award, permission: "employees.view" },
  { href: "/hr/contracts", labelKey: "contracts", icon: FileText, permission: "documents.manage" },
  { href: "/hr/documents", labelKey: "documents", icon: ClipboardList, permission: "documents.manage" },
  { href: "/hr/leaves", labelKey: "leaveManagement", icon: CalendarDays, permission: "leave.team.view" },
  { href: "/hr/warnings", labelKey: "warnings", icon: AlertTriangle, permission: "employees.edit" },
  { href: "/hr/training", labelKey: "training", icon: GraduationCap, permission: "training.manage" },
  { href: "/hr/assets", labelKey: "assets", icon: Package, permission: "assets.manage" },
  { href: "/hr/payroll-profiles", labelKey: "payrollProfiles", icon: Wallet, permission: "payroll.view" },
  { href: "/hr/payroll-runs", labelKey: "payrollRuns", icon: CreditCard, permission: "payroll.view" },
  { href: "/hr/onboarding", labelKey: "onboarding", icon: UserPlus, permission: "employees.create" },
  { href: "/hr/offboarding", labelKey: "offboarding", icon: UserMinus, permission: "employees.deactivate" },
  { href: "/hr/reports", labelKey: "hrReports", icon: FileBarChart, permission: "reports.view" },
  { href: "/team-coach", labelKey: "teamCoachAI", icon: Brain, permission: "ai.use" },
  { href: "/daily-briefing", labelKey: "dailyBriefing", icon: Sunrise, permission: "reports.view" },
  { href: "/coach-library", labelKey: "coachLibrary", icon: BookOpen, permission: "ai.use" },
  { href: "/audit", labelKey: "auditLog", icon: ScrollText, permission: "audit.view" },
  { href: "/billing", labelKey: "billing", icon: CreditCard, permission: "billing.view" },
  { href: "/settings", labelKey: "settings", icon: Settings, permission: "company.settings.manage" },
  { href: "/support", labelKey: "support", icon: LifeBuoy, permission: "support.use" },
];

const tenantEmployeeNavKeys: NavItem[] = [
  { href: "/today", labelKey: "today", icon: CalendarClock, permission: "attendance.self.view" },
  { href: "/clock", labelKey: "clockInOut", icon: Clock, permission: "attendance.self.clock" },
  { href: "/my-schedule", labelKey: "mySchedule", icon: CalendarDays, permission: "schedules.self.view" },
  { href: "/attendance", labelKey: "myAttendance", icon: ClipboardList, permission: "attendance.self.view" },
  { href: "/my-leave", labelKey: "myLeave", icon: CalendarDays, permission: "leave.self.view" },
  { href: "/requests", labelKey: "myRequests", icon: CheckSquare, permission: "leave.self.request" },
  { href: "/my-training", labelKey: "myTraining", icon: GraduationCap, permission: "training.self.view" },
  { href: "/my-assets", labelKey: "myAssets", icon: Package, permission: "assets.self.view" },
  { href: "/my-warnings", labelKey: "myWarnings", icon: AlertTriangle, permission: "attendance.self.view" },
  { href: "/coach", labelKey: "myCoachAI", icon: Sparkles, permission: "ai.use" },
  { href: "/privacy", labelKey: "privacy", icon: Shield, permission: "company.view" },
  { href: "/profile", labelKey: "myProfile", icon: UserIcon, permission: "company.view" },
];

const MANAGEMENT_PERMISSIONS = new Set([
  "users.view",
  "employees.view",
  "branches.view",
  "attendance.team.view",
  "schedules.team.view",
  "reports.view",
  "payroll.view",
  "company.settings.manage",
]);

function filterByPermission(items: NavItem[], permissions?: string[]) {
  if (!permissions) return items;
  const allowed = new Set(permissions);
  return items.filter((item) => !item.permission || allowed.has(item.permission));
}

export function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const locale = useLocale();
  const roleLabels: Record<string, string> = {
    COMPANY_OWNER: locale === "ar" ? "مالك الشركة" : "Company Owner",
    HR_ADMIN: locale === "ar" ? "مسؤول الموارد البشرية" : "HR Admin",
    BRANCH_MANAGER: locale === "ar" ? "مدير فرع" : "Branch Manager",
    EMPLOYEE: locale === "ar" ? "موظف" : "Employee",
    SUPER_ADMIN: locale === "ar" ? "مدير المنصة" : "Super Admin",
    SALES_ADMIN: locale === "ar" ? "مدير المبيعات" : "Sales Admin",
  };

  const permissions = user.permissions ?? [];
  const hasManagementAccess = permissions.some((permission) => MANAGEMENT_PERMISSIONS.has(permission));
  const items = user.kind === "platform"
    ? platformNavKeys
    : hasManagementAccess || user.role !== "EMPLOYEE"
      ? filterByPermission(tenantManagementNavKeys, user.permissions)
      : filterByPermission(tenantEmployeeNavKeys, user.permissions);

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <Logo className="h-7 w-7" />
        <span className="text-base font-semibold text-sidebar-foreground">B-Attend</span>
      </div>
      <nav className="battend-scroll flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{t(item.labelKey as any)}</span>
                  {item.badge ? (
                    <span className="rounded bg-sidebar-foreground/10 px-1.5 py-0.5 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/60">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-sidebar-foreground">{user.name}</p>
            <p className="truncate text-xs uppercase tracking-wider text-sidebar-foreground/60">{roleLabels[user.role] || user.role.replace(/_/g, " ")}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
