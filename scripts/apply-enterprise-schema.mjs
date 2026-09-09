import { readFileSync, writeFileSync } from "node:fs";

const path = "prisma/schema.prisma";
let schema = readFileSync(path, "utf8");

if (
  schema.includes("enum AccessScopeType") &&
  schema.includes("enum UserInvitationStatus") &&
  schema.includes("MOBILE_APP") &&
  schema.includes("model TenantRole {") &&
  schema.includes("model UserRoleAssignment {") &&
  schema.includes("model UserInvitation {")
) {
  console.log("Enterprise IAM schema is already applied.");
  process.exit(0);
}

function replaceOnce(anchor, replacement, label) {
  if (!schema.includes(anchor)) throw new Error(`Schema anchor not found: ${label}`);
  schema = schema.replace(anchor, replacement);
}

if (!schema.includes("enum AccessScopeType")) {
  replaceOnce(
    `enum TenantUserStatus {\n  ACTIVE\n  INVITED\n  SUSPENDED\n  LEFT\n}\n\nenum BranchStatus {`,
    `enum TenantUserStatus {\n  ACTIVE\n  INVITED\n  SUSPENDED\n  LEFT\n}\n\nenum AccessScopeType {\n  TENANT\n  BRANCH\n  DEPARTMENT\n  SELF\n}\n\nenum UserInvitationStatus {\n  PENDING\n  ACCEPTED\n  EXPIRED\n  REVOKED\n}\n\nenum BranchStatus {`,
    "tenant IAM enums",
  );
}

if (!schema.includes("  MOBILE_APP\n")) {
  replaceOnce(
    `enum PunchSource {\n  MOBILE_WEB\n`,
    `enum PunchSource {\n  MOBILE_WEB\n  MOBILE_APP\n`,
    "native mobile punch source",
  );
}

if (!schema.includes("tenantRoles") || !schema.includes("userRoleAssignments")) {
  replaceOnce(
    `  users          User[]\n  settings       CompanySettings?`,
    `  users          User[]\n  tenantRoles      TenantRole[]\n  tenantRolePermissions TenantRolePermission[]\n  userRoleAssignments UserRoleAssignment[]\n  userInvitations UserInvitation[]\n  userInvitationRoles UserInvitationRole[]\n  settings       CompanySettings?`,
    "tenant IAM relations",
  );
}

if (!schema.includes("roleAssignments")) {
  replaceOnce(
    `  passwordResetTokens PasswordResetToken[]\n  createdAt`,
    `  passwordResetTokens PasswordResetToken[]\n  roleAssignments UserRoleAssignment[]\n  createdAt`,
    "user role assignments relation",
  );
}

if (!schema.includes("accessInvitations")) {
  replaceOnce(
    `  user              User?\n  // HR relations`,
    `  user              User?\n  accessInvitations UserInvitation[]\n  // HR relations`,
    "employee invitation relation",
  );
}

if (!schema.includes("model TenantRole {")) {
  schema += `\n\n// ============================================================\n// TENANT IDENTITY & ACCESS MANAGEMENT\n// ============================================================\n\nmodel TenantRole {\n  id          String   @id @default(cuid())\n  companyId   String\n  tenant      Tenant   @relation(fields: [companyId], references: [id], onDelete: Cascade)\n  code        String\n  name        String\n  description String?\n  isSystem    Boolean  @default(false)\n  isEditable  Boolean  @default(true)\n  createdAt   DateTime @default(now())\n  updatedAt   DateTime @updatedAt\n  deletedAt   DateTime?\n\n  permissions     TenantRolePermission[]\n  assignments     UserRoleAssignment[]\n  invitationRoles UserInvitationRole[]\n\n  @@unique([companyId, code])\n  @@index([companyId])\n  @@index([isSystem])\n}\n\nmodel TenantRolePermission {\n  id            String     @id @default(cuid())\n  companyId     String\n  tenant        Tenant     @relation(fields: [companyId], references: [id], onDelete: Cascade)\n  roleId        String\n  role          TenantRole @relation(fields: [roleId], references: [id], onDelete: Cascade)\n  permissionKey String\n  createdAt     DateTime   @default(now())\n\n  @@unique([roleId, permissionKey])\n  @@index([companyId, permissionKey])\n}\n\nmodel UserRoleAssignment {\n  id              String          @id @default(cuid())\n  companyId       String\n  tenant          Tenant          @relation(fields: [companyId], references: [id], onDelete: Cascade)\n  userId          String\n  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)\n  roleId          String\n  role            TenantRole      @relation(fields: [roleId], references: [id], onDelete: Cascade)\n  scopeType       AccessScopeType @default(TENANT)\n  scopeId         String?\n  scopeKey        String          @default("*")\n  grantedByUserId String?\n  expiresAt       DateTime?\n  revokedAt       DateTime?\n  createdAt       DateTime        @default(now())\n  updatedAt       DateTime        @updatedAt\n\n  @@unique([userId, roleId, scopeType, scopeKey])\n  @@index([companyId, userId])\n  @@index([roleId])\n}\n\nmodel UserInvitation {\n  id               String               @id @default(cuid())\n  companyId        String\n  tenant           Tenant               @relation(fields: [companyId], references: [id], onDelete: Cascade)\n  email            String\n  name             String\n  employeeId       String?\n  employee         Employee?            @relation(fields: [employeeId], references: [id], onDelete: SetNull)\n  tokenHash        String               @unique\n  status           UserInvitationStatus @default(PENDING)\n  expiresAt        DateTime\n  invitedByUserId  String\n  acceptedByUserId String?\n  acceptedAt       DateTime?\n  revokedAt        DateTime?\n  createdAt        DateTime             @default(now())\n  updatedAt        DateTime             @updatedAt\n\n  roles UserInvitationRole[]\n\n  @@index([companyId, email, status])\n  @@index([expiresAt])\n}\n\nmodel UserInvitationRole {\n  id           String          @id @default(cuid())\n  companyId    String\n  tenant       Tenant          @relation(fields: [companyId], references: [id], onDelete: Cascade)\n  invitationId String\n  invitation   UserInvitation  @relation(fields: [invitationId], references: [id], onDelete: Cascade)\n  roleId       String\n  role         TenantRole      @relation(fields: [roleId], references: [id], onDelete: Cascade)\n  scopeType    AccessScopeType @default(TENANT)\n  scopeId      String?\n  scopeKey     String          @default("*")\n  createdAt    DateTime        @default(now())\n\n  @@unique([invitationId, roleId, scopeType, scopeKey])\n  @@index([companyId])\n}\n`;
}

writeFileSync(path, schema);
console.log("Enterprise IAM schema patch applied.");
