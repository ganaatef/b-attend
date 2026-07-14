"use client";

/**
 * AppShell — wraps authenticated pages with Sidebar + Header + MobileBottomNav.
 * Reads session from server via prop, provides logout handler.
 */
import { useRouter } from "next/navigation";
import { Sidebar, type SidebarUser } from "./Sidebar";
import { Header } from "./Header";
import { MobileBottomNav } from "./MobileBottomNav";
import { SubscriptionBanner } from "@/components/banners/SubscriptionBanner";

export interface AppShellSession extends SidebarUser {
  subscriptionStatus?: string;
  trialEndsAt?: string | null;
}

export function AppShell({ session, children }: { session: AppShellSession; children: React.ReactNode }) {
  const router = useRouter();

  async function handleLogout() {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (res.ok) router.push("/login");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar user={session} />
      <div className="flex min-w-0 flex-1 flex-col">
        {session.subscriptionStatus && session.subscriptionStatus !== "ACTIVE" && (
          <SubscriptionBanner status={session.subscriptionStatus} trialEndsAt={session.trialEndsAt} />
        )}
        <Header user={session} onLogout={handleLogout} />
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-6">{children}</main>
        <MobileBottomNav />
      </div>
    </div>
  );
}
