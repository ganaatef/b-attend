import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

/** Legacy route retained for bookmarks; user management now lives in /access. */
export default async function UsersPage() {
  await requirePermission("users.view");
  redirect("/access");
}
