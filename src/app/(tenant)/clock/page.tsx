/** /clock — server entry */
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { ClockPage } from "./ClockPage";

export const dynamic = "force-dynamic";

export default async function ClockRoute() {
  const session = await getSession();
  if (!session?.tenantId) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  // For employee self-service, link to user's employee record
  const user = await db.user.findUnique({
    where: { id: session.sub },
    include: { employee: { include: { branch: true, defaultShiftPolicy: true } } },
  });

  const employee = user?.employee ?? null;

  const schedule = employee ? await db.schedule.findUnique({
    where: { companyId_employeeId_date: { companyId: session.tenantId, employeeId: employee.id, date: today } },
    include: { shiftPolicy: true },
  }) : null;

  const lastPunch = employee ? await db.punch.findFirst({
    where: { employeeId: employee.id, timestamp: { gte: today, lt: tomorrow } },
    orderBy: { timestamp: "desc" },
  }) : null;

  return <ClockPage employee={employee} schedule={schedule} lastPunch={lastPunch} />;
}
