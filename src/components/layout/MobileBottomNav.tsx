"use client";

/**
 * Mobile bottom nav — shown on screens < md.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutDashboard, Clock, CalendarDays, CheckSquare, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", labelKey: "home" as const, icon: LayoutDashboard },
  { href: "/today", labelKey: "today" as const, icon: Clock },
  { href: "/schedules", labelKey: "schedules" as const, icon: CalendarDays },
  { href: "/approvals", labelKey: "requests" as const, icon: CheckSquare },
  { href: "/profile", labelKey: "profile" as const, icon: UserIcon },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const t = useTranslations("mobileNav");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-border bg-background/95 backdrop-blur md:hidden">
      {items.map((it) => {
        const active = pathname === it.href || pathname.startsWith(it.href + "/");
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-1.5 text-[10px] font-medium",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{t(it.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
