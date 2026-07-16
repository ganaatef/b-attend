"use client";

/**
 * Authenticated top header — desktop.
 */
import Link from "next/link";
import { LogOut, Bell, User as UserIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { SidebarUser } from "./Sidebar";
import { LanguageSwitcher } from "./LanguageSwitcher";

const phaseLabels: Record<string, string> = {
  "/admin": "superAdminCenter",
  "/dashboard": "companyDashboard",
  "/today": "myDay",
  "/live": "liveAttendance",
};

export function Header({ user, onLogout }: { user: SidebarUser; onLogout: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("header");
  const tNav = useTranslations("nav");
  const phaseKey = phaseLabels[pathname];
  const title = phaseKey ? t(phaseKey as any) : "B-Attend";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
      <h1 className="text-sm font-semibold text-foreground sm:text-base">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitcher />
        <button
          type="button"
          aria-label={t("notifications")}
          className="hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted sm:inline-flex"
        >
          <Bell className="h-4 w-4" />
        </button>
        <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs sm:flex">
          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">{user.name}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{user.email}</span>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
        >
          <LogOut className="h-3.5 w-3.5" />
          {t("logout")}
        </button>
      </div>
    </header>
  );
}
