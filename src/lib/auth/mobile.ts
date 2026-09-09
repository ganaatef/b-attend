import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireActiveSubscription } from "./tenant";
import { verifyMobileSessionToken } from "./session";

export type MobileEmployeeContext = {
  user: { id: string; email: string; name: string; companyId: string };
  employee: {
    id: string;
    companyId: string;
    fullName: string;
    arabicName: string | null;
    jobTitle: string | null;
    branchId: string | null;
    branch: { id: string; name: string; latitude: number | null; longitude: number | null; geofenceRadius: number } | null;
    defaultShiftPolicy: { id: string; allowsMobileClockIn: boolean; allowNoScheduleClockIn: boolean } | null;
  };
};

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
}

/** Resolves a native token to an active employee belonging to an operational tenant. */
export async function requireMobileEmployee(request: NextRequest): Promise<MobileEmployeeContext | null> {
  const token = getBearerToken(request);
  if (!token) return null;

  const session = await verifyMobileSessionToken(token);
  if (!session || session.kind !== "tenant" || session.role !== "EMPLOYEE" || !session.tenantId) return null;

  const [user, operational] = await Promise.all([
    db.user.findFirst({
      where: {
        id: session.sub,
        companyId: session.tenantId,
        role: "EMPLOYEE",
        status: "ACTIVE",
        deletedAt: null,
        employeeId: { not: null },
      },
      include: {
        employee: {
          include: {
            branch: { select: { id: true, name: true, latitude: true, longitude: true, geofenceRadius: true } },
            defaultShiftPolicy: { select: { id: true, allowsMobileClockIn: true, allowNoScheduleClockIn: true } },
          },
        },
      },
    }),
    requireActiveSubscription(session.tenantId),
  ]);

  if (!operational || !user?.employee || user.employee.status !== "ACTIVE" || user.employee.deletedAt) return null;

  return {
    user: { id: user.id, email: user.email, name: user.name, companyId: user.companyId },
    employee: user.employee,
  };
}
