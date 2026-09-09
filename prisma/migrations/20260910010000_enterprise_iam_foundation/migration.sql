CREATE TYPE "AccessScopeType" AS ENUM ('TENANT', 'BRANCH', 'DEPARTMENT', 'SELF');
CREATE TYPE "UserInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

CREATE TABLE "TenantRole" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "TenantRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantRolePermission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TenantRolePermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scopeType" "AccessScopeType" NOT NULL DEFAULT 'TENANT',
    "scopeId" TEXT,
    "scopeKey" TEXT NOT NULL DEFAULT '*',
    "grantedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserInvitation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employeeId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "UserInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "acceptedByUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserInvitationRole" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scopeType" "AccessScopeType" NOT NULL DEFAULT 'TENANT',
    "scopeId" TEXT,
    "scopeKey" TEXT NOT NULL DEFAULT '*',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserInvitationRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantRole_companyId_code_key" ON "TenantRole"("companyId", "code");
CREATE INDEX "TenantRole_companyId_idx" ON "TenantRole"("companyId");
CREATE INDEX "TenantRole_isSystem_idx" ON "TenantRole"("isSystem");
CREATE UNIQUE INDEX "TenantRolePermission_roleId_permissionKey_key" ON "TenantRolePermission"("roleId", "permissionKey");
CREATE INDEX "TenantRolePermission_companyId_permissionKey_idx" ON "TenantRolePermission"("companyId", "permissionKey");
CREATE UNIQUE INDEX "UserRoleAssignment_userId_roleId_scopeType_scopeKey_key" ON "UserRoleAssignment"("userId", "roleId", "scopeType", "scopeKey");
CREATE INDEX "UserRoleAssignment_companyId_userId_idx" ON "UserRoleAssignment"("companyId", "userId");
CREATE INDEX "UserRoleAssignment_roleId_idx" ON "UserRoleAssignment"("roleId");
CREATE UNIQUE INDEX "UserInvitation_tokenHash_key" ON "UserInvitation"("tokenHash");
CREATE INDEX "UserInvitation_companyId_email_status_idx" ON "UserInvitation"("companyId", "email", "status");
CREATE INDEX "UserInvitation_expiresAt_idx" ON "UserInvitation"("expiresAt");
CREATE UNIQUE INDEX "UserInvitationRole_invitationId_roleId_scopeType_scopeKey_key" ON "UserInvitationRole"("invitationId", "roleId", "scopeType", "scopeKey");
CREATE INDEX "UserInvitationRole_companyId_idx" ON "UserInvitationRole"("companyId");

ALTER TABLE "TenantRole" ADD CONSTRAINT "TenantRole_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantRolePermission" ADD CONSTRAINT "TenantRolePermission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantRolePermission" ADD CONSTRAINT "TenantRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "TenantRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "TenantRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserInvitationRole" ADD CONSTRAINT "UserInvitationRole_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserInvitationRole" ADD CONSTRAINT "UserInvitationRole_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "UserInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserInvitationRole" ADD CONSTRAINT "UserInvitationRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "TenantRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
