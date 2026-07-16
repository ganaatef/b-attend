"use client";

/**
 * Authenticated sidebar — desktop (md+).
 * Renders different nav items based on session role/kind.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
  phase?: number;
}

const platformNavKeys: NavItem[] = [
  { href: "/admin", labelKey: "dashboard", icon: LayoutDashboard, phase: 2 },
  { href: "/admin/tenants", labelKey: "tenants", icon: Building2, phase: 2 },
  { href: "/admin/subscriptions", labelKey: "subscriptions", icon: CreditCard, phase: 2 },
  { href: "/admin/plans", labelKey: "plans", icon: ShieldCheck, phase: 2 },
  { href: "/admin/invoices", labelKey: "invoices", icon: FileBarChart, phase: 2 },
  { href: "/admin/leads", labelKey: "leads", icon: Users, phase: 2 },
  { href: "/admin/support", labelKey: "support", icon: LifeBuoy, phase: 2 },
  { href: "/admin/audit", labelKey: "platformAudit", icon: ScrollText, phase: 2 },
  { href: "/admin/ai", labelKey: "aiControls", icon: Brain, phase: 9 },
  { href: "/admin/coach-library", labelKey: "coachTips", icon: BookOpen, phase: 9 },
  { href: "/admin/settings", labelKey: "adminSettings", icon: Settings, phase: 2 },
];

const tenantBranchManagerNavKeys: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard, phase: 3 },
  { href: "/live", labelKey: "liveAttendance", icon: TabletSmartphone, phase: 4 },
  { href: "/branches", labelKey: "branches", icon: Building2, phase: 3 },
  { href: "/employees", labelKey: "employees", icon: Users, phase: 3 },
  { href: "/policies", labelKey: "shiftPolicies", icon: Clock, phase: 3 },
  { href: "/schedules", labelKey: "schedules", icon: CalendarDays, phase: 3 },
  { href: "/kiosk", labelKey: "kiosk", icon: TabletSmartphone, phase: 4 },
  { href: "/approvals", labelKey: "approvals", icon: CheckSquare, phase: 5 },
  { href: "/reports", labelKey: "reports", icon: FileBarChart, phase: 6 },
  { href: "/hr", labelKey: "hrDashboard", icon: Briefcase, phase: 2 },
  { href: "/hr/departments", labelKey: "departments", icon: FolderTree, phase: 2 },
  { href: "/hr/job-titles", labelKey: "jobTitles", icon: Award, phase: 2 },
  { href: "/hr/contracts", labelKey: "contracts", icon: FileText, phase: 3 },
  { href: "/hr/documents", labelKey: "documents", icon: ClipboardList, phase: 3 },
  { href: "/hr/leaves", labelKey: "leaveManagement", icon: CalendarDays, phase: 3 },
  { href: "/hr/warnings", labelKey: "warnings", icon: AlertTriangle, phase: 4 },
  { href: "/hr/training", labelKey: "training", icon: GraduationCap, phase: 4 },
  { href: "/hr/assets", labelKey: "assets", icon: Package, phase: 4 },
  { href: "/hr/onboarding", labelKey: "onboarding", icon: UserPlus, phase: 4 },
  { href: "/hr/offboarding", labelKey: "offboarding", icon: UserMinus, phase: 4 },
  { href: "/hr/reports", labelKey: "hrReports", icon: FileBarChart, phase: 10 },
  { href: "/team-coach", labelKey: "teamCoachAI", icon: Brain, phase: 9 },
  { href: "/daily-briefing", labelKey: "dailyBriefing", icon: Sunrise, phase: 9 },
  { href: "/support", labelKey: "support", icon: LifeBuoy, phase: 7 },
];

const tenantOwnerNavKeys: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard, phase: 3 },
  { href: "/live", labelKey: "liveAttendance", icon: TabletSmartphone, phase: 4 },
  { href: "/branches", labelKey: "branches", icon: Building2, phase: 3 },
  { href: "/employees", labelKey: "employees", icon: Users, phase: 3 },
  { href: "/policies", labelKey: "shiftPolicies", icon: Clock, phase: 3 },
  { href: "/schedules", labelKey: "schedules", icon: CalendarDays, phase: 3 },
  { href: "/kiosk", labelKey: "kiosk", icon: TabletSmartphone, phase: 4 },
  { href: "/approvals", labelKey: "approvals", icon: CheckSquare, phase: 5 },
  { href: "/reports", labelKey: "reports", icon: FileBarChart, phase: 6 },
  { href: "/hr", labelKey: "hrDashboard", icon: Briefcase, phase: 2 },
  { href: "/hr/departments", labelKey: "departments", icon: FolderTree, phase: 2 },
  { href: "/hr/job-titles", labelKey: "jobTitles", icon: Award, phase: 2 },
  { href: "/hr/contracts", labelKey: "contracts", icon: FileText, phase: 3 },
  { href: "/hr/documents", labelKey: "documents", icon: ClipboardList, phase: 3 },
  { href: "/hr/leaves", labelKey: "leaveManagement", icon: CalendarDays, phase: 3 },
  { href: "/hr/warnings", labelKey: "warnings", icon: AlertTriangle, phase: 4 },
  { href: "/hr/training", labelKey: "training", icon: GraduationCap, phase: 4 },
  { href: "/hr/assets", labelKey: "assets", icon: Package, phase: 4 },
  { href: "/hr/payroll-profiles", labelKey: "payrollProfiles", icon: Wallet, phase: 5 },
  { href: "/hr/payroll-runs", labelKey: "payrollRuns", icon: CreditCard, phase: 5 },
  { href: "/hr/onboarding", labelKey: "onboarding", icon: UserPlus, phase: 4 },
  { href: "/hr/offboarding", labelKey: "offboarding", icon: UserMinus, phase: 4 },
  { href: "/hr/reports", labelKey: "hrReports", icon: FileBarChart, phase: 10 },
  { href: "/team-coach", labelKey: "teamCoachAI", icon: Brain, phase: 9 },
  { href: "/daily-briefing", labelKey: "dailyBriefing", icon: Sunrise, phase: 9 },
  { href: "/coach-library", labelKey: "coachLibrary", icon: BookOpen, phase: 9 },
  { href: "/audit", labelKey: "auditLog", icon: ScrollText, phase: 5 },
  { href: "/billing", labelKey: "billing", icon: CreditCard, phase: 7 },
  { href: "/settings", labelKey: "settings", icon: Settings, phase: 7 },
];

const tenantEmployeeNavKeys: NavItem[] = [
  { href: "/today", labelKey: "today", icon: CalendarClock, phase: 4 },
  { href: "/clock", labelKey: "clockInOut", icon: Clock, phase: 4 },
  { href: "/my-leave", labelKey: "myLeave", icon: CalendarDays, phase: 3 },
  { href: "/coach", labelKey: "myCoachAI", icon: Sparkles, phase: 9 },
  { href: "/attendance", labelKey: "myAttendance", icon: ClipboardList, phase: 6 },
  { href: "/requests", labelKey: "myRequests", icon: CheckSquare, phase: 5 },
  { href: "/my-training", labelKey: "myTraining", icon: GraduationCap, phase: 3 },
  { href: "/my-assets", labelKey: "myAssets", icon: Package, phase: 3 },
  { href: "/my-warnings", labelKey: "myWarnings", icon: AlertTriangle, phase: 3 },
  { href: "/profile", labelKey: "myProfile", icon: UserIcon, phase: 7 },
];

export function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const items = user.kind === "platform" ? platformNavKeys : user.role === "EMPLOYEE" ? tenantEmployeeNavKeys : user.role === "BRANCH_MANAGER" ? tenantBranchManagerNavKeys : tenantOwnerNavKeys;

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
                  {item.phase ? (
                    <span className="rounded bg-sidebar-foreground/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/60">
                      P{item.phase}
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
            <p className="truncate text-[10px] uppercase tracking-wider text-sidebar-foreground/60">{user.role.replace(/_/g, " ")}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
