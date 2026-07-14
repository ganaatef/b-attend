"use client";

/**
 * Mobile bottom nav — shown on screens < md.
 * Highlights the active route based on pathname prefix.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Clock, CalendarDays, CheckSquare, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/today", label: "Today", icon: Clock },
  { href: "/schedules", label: "Schedules", icon: CalendarDays },
  { href: "/approvals", label: "Requests", icon: CheckSquare },
  { href: "/profile", label: "Profile", icon: UserIcon },
];

export function MobileBottomNav() {
  const pathname = usePathname();
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
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
