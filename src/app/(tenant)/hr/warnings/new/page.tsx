import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { WarningForm } from "./WarningForm";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function NewWarningPage() {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (!hasPerm(session.role, "MANAGE_WARNINGS")) return null;
  const tid = session.tenantId;

  const employees = await db.employee.findMany({
    where: { companyId: tid, deletedAt: null },
    select: { id: true, fullName: true, employeeCode: true, branch: { select: { name: true } } },
    orderBy: { fullName: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/hr/warnings" className="text-xs text-muted-foreground hover:text-foreground">← Warnings</Link>
        <h1 className="mt-1 text-lg font-bold text-foreground">New Warning</h1>
      </div>
      <WarningForm employees={employees} />
    </div>
  );
}
