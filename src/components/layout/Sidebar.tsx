"use client";

/**
 * Authenticated sidebar — desktop (md+).
 * Renders different nav items based on session role/kind.
 */
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
} from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

export interface SidebarUser {
  name: string;
  email: string;
  role: string;
  kind: "platform" | "tenant";
}

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

// ─── Platform (SUPER_ADMIN) ──────────────────────────────────────
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

// ─── COMPANY_OWNER — full tenant access ─────────────────────────
const tenantOwnerNavKeys: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/live", labelKey: "liveAttendance", icon: TabletSmartphone },
  { href: "/branches", labelKey: "branches", icon: Building2 },
  { href: "/employees", labelKey: "employees", icon: Users },
  { href: "/policies", labelKey: "shiftPolicies", icon: Clock },
  { href: "/schedules", labelKey: "schedules", icon: CalendarDays },
  { href: "/kiosk", labelKey: "kiosk", icon: TabletSmartphone },
  { href: "/approvals", labelKey: "approvals", icon: CheckSquare },
  { href: "/reports", labelKey: "reports", icon: FileBarChart },
  { href: "/hr", labelKey: "hrDashboard", icon: Briefcase },
  { href: "/hr/departments", labelKey: "departments", icon: FolderTree },
  { href: "/hr/job-titles", labelKey: "jobTitles", icon: Award },
  { href: "/hr/contracts", labelKey: "contracts", icon: FileText },
  { href: "/hr/documents", labelKey: "documents", icon: ClipboardList },
  { href: "/hr/leaves", labelKey: "leaveManagement", icon: CalendarDays },
  { href: "/hr/warnings", labelKey: "warnings", icon: AlertTriangle },
  { href: "/hr/training", labelKey: "training", icon: GraduationCap },
  { href: "/hr/assets", labelKey: "assets", icon: Package },
  { href: "/hr/payroll-profiles", labelKey: "payrollProfiles", icon: Wallet },
  { href: "/hr/payroll-runs", labelKey: "payrollRuns", icon: CreditCard },
  { href: "/hr/onboarding", labelKey: "onboarding", icon: UserPlus },
  { href: "/hr/offboarding", labelKey: "offboarding", icon: UserMinus },
  { href: "/hr/reports", labelKey: "hrReports", icon: FileBarChart },
  { href: "/team-coach", labelKey: "teamCoachAI", icon: Brain },
  { href: "/daily-briefing", labelKey: "dailyBriefing", icon: Sunrise },
  { href: "/coach-library", labelKey: "coachLibrary", icon: BookOpen },
  { href: "/audit", labelKey: "auditLog", icon: ScrollText },
  { href: "/billing", labelKey: "billing", icon: CreditCard },
  { href: "/settings", labelKey: "settings", icon: Settings },
];

// ─── HR_ADMIN — same as owner minus billing ─────────────────────
const tenantHrAdminNavKeys: NavItem[] = tenantOwnerNavKeys.filter(
  (item) => item.href !== "/billing"
);

// ─── BRANCH_MANAGER — branch-scoped, demo-safe ─────────────────
const tenantBranchManagerNavKeys: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/live", labelKey: "liveAttendance", icon: TabletSmartphone },
  { href: "/branches", labelKey: "branches", icon: Building2 },
  { href: "/employees", labelKey: "employees", icon: Users },
  { href: "/policies", labelKey: "shiftPolicies", icon: Clock },
  { href: "/schedules", labelKey: "schedules", icon: CalendarDays },
  { href: "/kiosk", labelKey: "kiosk", icon: TabletSmartphone },
  { href: "/approvals", labelKey: "approvals", icon: CheckSquare },
  { href: "/reports", labelKey: "reports", icon: FileBarChart },
  { href: "/hr", labelKey: "hrDashboard", icon: Briefcase },
  { href: "/hr/leaves", labelKey: "leaveManagement", icon: CalendarDays },
  { href: "/hr/training", labelKey: "training", icon: GraduationCap },
  { href: "/hr/assets", labelKey: "assets", icon: Package },
  { href: "/hr/reports", labelKey: "hrReports", icon: FileBarChart },
  { href: "/team-coach", labelKey: "teamCoachAI", icon: Brain },
  { href: "/daily-briefing", labelKey: "dailyBriefing", icon: Sunrise },
  { href: "/support", labelKey: "support", icon: LifeBuoy },
];

// ─── EMPLOYEE — self-service only ───────────────────────────────
const tenantEmployeeNavKeys: NavItem[] = [
  { href: "/today", labelKey: "today", icon: CalendarClock },
  { href: "/clock", labelKey: "clockInOut", icon: Clock },
  { href: "/my-schedule", labelKey: "mySchedule", icon: CalendarDays },
  { href: "/attendance", labelKey: "myAttendance", icon: ClipboardList },
  { href: "/my-leave", labelKey: "myLeave", icon: CalendarDays },
  { href: "/requests", labelKey: "myRequests", icon: CheckSquare },
  { href: "/my-training", labelKey: "myTraining", icon: GraduationCap },
  { href: "/my-assets", labelKey: "myAssets", icon: Package },
  { href: "/my-warnings", labelKey: "myWarnings", icon: AlertTriangle },
  { href: "/coach", labelKey: "myCoachAI", icon: Sparkles },
  { href: "/profile", labelKey: "myProfile", icon: UserIcon },
];

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

  const items =
    user.kind === "platform"
      ? platformNavKeys
      : user.role === "EMPLOYEE"
        ? tenantEmployeeNavKeys
        : user.role === "BRANCH_MANAGER"
          ? tenantBranchManagerNavKeys
          : user.role === "HR_ADMIN"
            ? tenantHrAdminNavKeys
            : tenantOwnerNavKeys;

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
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
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
