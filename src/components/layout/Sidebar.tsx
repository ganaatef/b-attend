"use client";

/**
 * Authenticated sidebar — desktop (md+).
 * Renders different nav items based on session role/kind.
 * Phase 1: only shows stub routes with "Coming in Phase X" markers.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Bell,
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
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  phase?: number;
}

const platformNav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, phase: 2 },
  { href: "/admin/tenants", label: "Tenants", icon: Building2, phase: 2 },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard, phase: 2 },
  { href: "/admin/plans", label: "Plans", icon: ShieldCheck, phase: 2 },
  { href: "/admin/invoices", label: "Invoices", icon: FileBarChart, phase: 2 },
  { href: "/admin/leads", label: "Leads", icon: Users, phase: 2 },
  { href: "/admin/support", label: "Support", icon: LifeBuoy, phase: 2 },
  { href: "/admin/audit", label: "Platform Audit", icon: ScrollText, phase: 2 },
  { href: "/admin/ai", label: "AI Controls", icon: Brain, phase: 9 },
  { href: "/admin/coach-library", label: "Coach Tips", icon: BookOpen, phase: 9 },
  { href: "/admin/settings", label: "Settings", icon: Settings, phase: 2 },
];

const tenantOwnerNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, phase: 3 },
  { href: "/live", label: "Live Attendance", icon: TabletSmartphone, phase: 4 },
  { href: "/branches", label: "Branches", icon: Building2, phase: 3 },
  { href: "/employees", label: "Employees", icon: Users, phase: 3 },
  { href: "/policies", label: "Shift Policies", icon: Clock, phase: 3 },
  { href: "/schedules", label: "Schedules", icon: CalendarDays, phase: 3 },
  { href: "/kiosk", label: "Kiosk", icon: TabletSmartphone, phase: 4 },
  { href: "/approvals", label: "Approvals", icon: CheckSquare, phase: 5 },
  { href: "/reports", label: "Reports", icon: FileBarChart, phase: 6 },
  // HR section
  { href: "/hr", label: "HR Dashboard", icon: Briefcase, phase: 10 },
  { href: "/hr/departments", label: "Departments", icon: FolderTree, phase: 10 },
  { href: "/hr/job-titles", label: "Job Titles", icon: Award, phase: 10 },
  { href: "/hr/contracts", label: "Contracts", icon: FileText, phase: 10 },
  { href: "/hr/documents", label: "Documents", icon: ClipboardList, phase: 10 },
  { href: "/hr/leaves", label: "Leave Management", icon: CalendarDays, phase: 10 },
  { href: "/hr/warnings", label: "Warnings", icon: AlertTriangle, phase: 10 },
  { href: "/hr/training", label: "Training", icon: GraduationCap, phase: 10 },
  { href: "/hr/assets", label: "Assets & Uniforms", icon: Package, phase: 10 },
  { href: "/hr/payroll-profiles", label: "Payroll Profiles", icon: Wallet, phase: 10 },
  { href: "/hr/payroll-runs", label: "Payroll Runs", icon: CreditCard, phase: 10 },
  { href: "/hr/onboarding", label: "Onboarding", icon: UserPlus, phase: 10 },
  { href: "/hr/offboarding", label: "Offboarding", icon: UserMinus, phase: 10 },
  { href: "/hr/reports", label: "HR Reports", icon: FileBarChart, phase: 10 },
  // B-Coach AI
  { href: "/team-coach", label: "Team Coach AI", icon: Brain, phase: 9 },
  { href: "/daily-briefing", label: "Daily Briefing", icon: Sunrise, phase: 9 },
  { href: "/coach-library", label: "Coach Library", icon: BookOpen, phase: 9 },
  { href: "/audit", label: "Audit Log", icon: ScrollText, phase: 5 },
  { href: "/billing", label: "Billing", icon: CreditCard, phase: 7 },
  { href: "/support", label: "Support", icon: LifeBuoy, phase: 7 },
  { href: "/settings", label: "Settings", icon: Settings, phase: 7 },
];

const tenantEmployeeNav: NavItem[] = [
  { href: "/today", label: "Today", icon: CalendarClock, phase: 4 },
  { href: "/clock", label: "Clock In/Out", icon: Clock, phase: 4 },
  { href: "/coach", label: "My Coach AI", icon: Sparkles, phase: 9 },
  { href: "/attendance", label: "My Attendance", icon: ClipboardList, phase: 6 },
  { href: "/requests", label: "My Requests", icon: CheckSquare, phase: 5 },
  { href: "/profile", label: "My Profile", icon: UserIcon, phase: 7 },
];

export function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const items = user.kind === "platform" ? platformNav : user.role === "EMPLOYEE" ? tenantEmployeeNav : tenantOwnerNav;

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
                  <span className="flex-1">{item.label}</span>
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
