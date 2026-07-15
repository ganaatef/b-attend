/**
 * /admin/layout — wraps all admin pages with AppShell + impersonation banner.
 */
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { AppShell, type AppShellSession } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.kind !== "platform") {
    redirect("/login?next=/admin");
  }

  const appShellSession: AppShellSession = {
    name: session.name,
    email: session.email,
    role: session.role,
    kind: "platform",
  };

  return <AppShell session={appShellSession}>{children}</AppShell>;
}
