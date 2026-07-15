/** /kiosk — server entry */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { KioskPage } from "./KioskPage";

export const dynamic = "force-dynamic";

export default async function KioskRoute() {
  const session = await getSession();
  if (!session?.tenantId) return null;
  const branches = await db.branch.findMany({
    where: { companyId: session.tenantId, deletedAt: null, status: "ACTIVE" },
    orderBy: { name: "asc" },
  });
  return <KioskPage branches={branches} />;
}
