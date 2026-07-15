/** /hr/leaves/new — Create new leave request (server wrapper with auth/permission/feature gate) */
import { getSession } from "@/lib/auth/session";
import { canUseHrFeature } from "@/lib/hr/feature-gates";
import { getRolePermissions, type HrPermission } from "@/lib/hr/permissions";
import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";
import NewLeaveRequestClient from "./NewLeaveRequestClient";

export const dynamic = "force-dynamic";

function hasPerm(role: string, perm: HrPermission): boolean {
  return getRolePermissions(role).includes(perm);
}

export default async function NewLeaveRequestPage() {
  const session = await getSession();
  if (!session?.tenantId || session.kind !== "tenant") return null;
  if (session.role === "EMPLOYEE") return null;

  const tid = session.tenantId;

  const featureCheck = await canUseHrFeature(tid, "hr_leave");
  if (!featureCheck.allowed) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="border-dashed border-amber-300 bg-amber-50/40">
          <div className="pt-6 pb-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-amber-500" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">Leave Management requires Growth plan or higher</h3>
            <p className="mt-1 text-xs text-muted-foreground">{featureCheck.reason ?? "Upgrade to access leave features."}</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!hasPerm(session.role, "APPROVE_LEAVE") && !hasPerm(session.role, "MANAGE_LEAVE_BALANCES")) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="border-dashed border-amber-300 bg-amber-50/40">
          <div className="pt-6 pb-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-amber-500" />
            <h3 className="mt-2 text-sm font-semibold text-foreground">Permission Required</h3>
            <p className="mt-1 text-xs text-muted-foreground">You do not have permission to create leave requests.</p>
          </div>
        </Card>
      </div>
    );
  }

  return <NewLeaveRequestClient />;
}
