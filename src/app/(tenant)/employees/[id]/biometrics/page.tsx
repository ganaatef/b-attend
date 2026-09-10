import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { evaluatePermission } from "@/lib/auth/authorization";
import { configuredBiometricProviderKey } from "@/lib/attendance/biometric-identity";
import { BiometricEnrollmentControls } from "./BiometricEnrollmentControls";

export const dynamic = "force-dynamic";

export default async function EmployeeBiometricsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.kind !== "tenant" || !session.tenantId) return null;
  const { id } = await params;

  const employee = await db.employee.findFirst({
    where: { id, companyId: session.tenantId, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      employeeCode: true,
      branchId: true,
      departmentId: true,
      user: { select: { id: true, status: true, deletedAt: true } },
      biometricEnrollment: true,
      biometricVerificationSessions: {
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          purpose: true,
          status: true,
          providerKey: true,
          livenessConfidence: true,
          faceMatchScore: true,
          createdAt: true,
          completedAt: true,
          consumedAt: true,
        },
      },
    },
  });
  if (!employee) notFound();

  const access = await evaluatePermission({
    companyId: session.tenantId,
    userId: session.sub,
    legacyRole: session.role,
    permission: "biometrics.manage",
    scope: {
      branchId: employee.branchId,
      departmentId: employee.departmentId,
      targetUserId: employee.user?.id ?? null,
    },
  });
  if (!access.allowed) notFound();

  const provider = configuredBiometricProviderKey();
  const providerAvailable = provider === "aws_rekognition";
  const enrollment = employee.biometricEnrollment;
  const status = enrollment?.status ?? "NONE";
  const hasActiveUser = Boolean(employee.user && employee.user.status === "ACTIVE" && !employee.user.deletedAt);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link href={`/employees/${employee.id}`} className="text-xs text-muted-foreground hover:text-foreground">← Employee profile</Link>
        <h1 className="mt-1 text-xl font-bold">Biometric identity</h1>
        <p className="text-sm text-muted-foreground">{employee.fullName} · {employee.employeeCode}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            <span>Enrollment</span>
            <Badge variant={status === "ACTIVE" ? "default" : "outline"}>{status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div><span className="text-muted-foreground">Provider:</span> <span className="font-medium">{provider}</span></div>
            <div><span className="text-muted-foreground">Linked staff identity:</span> <span className="font-medium">{hasActiveUser ? "Active" : "Required"}</span></div>
            <div><span className="text-muted-foreground">Consent:</span> <span className="font-medium">{enrollment?.consentedAt ? `${enrollment.consentVersion ?? "recorded"} · ${enrollment.consentedAt.toISOString()}` : "Not recorded"}</span></div>
            <div><span className="text-muted-foreground">Enrollment version:</span> <span className="font-medium">{enrollment?.enrollmentVersion ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Enrolled:</span> <span className="font-medium">{enrollment?.enrolledAt?.toISOString() ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Last verified:</span> <span className="font-medium">{enrollment?.lastVerifiedAt?.toISOString() ?? "—"}</span></div>
          </div>

          <BiometricEnrollmentControls
            employeeId={employee.id}
            status={status}
            hasActiveUser={hasActiveUser}
            providerAvailable={providerAvailable}
          />

          <p className="text-xs text-muted-foreground">
            B-Attend stores only lifecycle metadata and opaque provider face references. Profile photos are not biometric enrollment material and raw liveness media is not stored in the operational database.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent verification sessions</CardTitle></CardHeader>
        <CardContent>
          {employee.biometricVerificationSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No biometric verification sessions yet.</p>
          ) : (
            <div className="space-y-2">
              {employee.biometricVerificationSessions.map((item) => (
                <div key={item.id} className="grid gap-1 rounded-md border p-3 text-xs sm:grid-cols-5">
                  <span className="font-medium">{item.purpose}</span>
                  <span>{item.status}</span>
                  <span>Liveness: {item.livenessConfidence == null ? "—" : `${item.livenessConfidence.toFixed(1)}%`}</span>
                  <span>Face: {item.faceMatchScore == null ? "—" : `${item.faceMatchScore.toFixed(1)}%`}</span>
                  <span className="text-muted-foreground">{item.createdAt.toISOString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
