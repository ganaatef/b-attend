import fs from "node:fs";

const path = "src/app/(tenant)/employees/[id]/page.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(marker, replacement, label) {
  const count = source.split(marker).length - 1;
  if (count !== 1) throw new Error(`Expected exactly one ${label} marker, found ${count}`);
  source = source.replace(marker, replacement);
}

replaceOnce(
`import { getSession } from "@/lib/auth/session";`,
`import { getSession } from "@/lib/auth/session";
import { evaluatePermission } from "@/lib/auth/authorization";`,
"authorization import",
);

replaceOnce(
`  const isSelf = session.sub === employee.userId;
  const isBranchManager = role === "BRANCH_MANAGER";`,
`  const biometricAccess = await evaluatePermission({
    companyId: tid,
    userId: session.sub,
    legacyRole: session.role,
    permission: "biometrics.manage",
    scope: {
      branchId: employee.branchId,
      departmentId: employee.departmentId,
      targetUserId: employee.user?.id ?? null,
    },
  });

  const isSelf = session.sub === employee.userId;
  const isBranchManager = role === "BRANCH_MANAGER";`,
"biometric authorization decision",
);

replaceOnce(
`        <div className="mt-2 flex items-center gap-2">
          <Badge variant={employee.status === "ACTIVE" ? "default" : "destructive"} className={employee.status === "ACTIVE" ? "bg-brand-success text-white border-transparent" : ""}>{getStatusLabel(employee.status, locale)}</Badge>
          <Badge variant="outline">{displayEmploymentType(employee.employmentType, locale)}</Badge>
        </div>`,
`        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={employee.status === "ACTIVE" ? "default" : "destructive"} className={employee.status === "ACTIVE" ? "bg-brand-success text-white border-transparent" : ""}>{getStatusLabel(employee.status, locale)}</Badge>
          <Badge variant="outline">{displayEmploymentType(employee.employmentType, locale)}</Badge>
          {biometricAccess.allowed && (
            <Link
              href={\`/employees/${employee.id}/biometrics\`}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
            >
              <Lock className="h-3.5 w-3.5" />
              {locale === "ar" ? "الهوية البيومترية" : "Biometric identity"}
            </Link>
          )}
        </div>`,
"employee header badges",
);

fs.writeFileSync(path, source);
console.log("Linked employee profile to scoped biometric identity management.");
