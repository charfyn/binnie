-- Additive multi-user access foundation. No existing Binnie domain record is
-- deleted or rewritten; legacy PrincipalMembership remains during the verified
-- compatibility window and is backfilled below.

CREATE TYPE "PrincipalStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'REMOVED');
CREATE TYPE "AccessLevel" AS ENUM ('OWNER', 'ORGANIZATION_MANAGER', 'DEPARTMENT_HEAD', 'MEMBER', 'VIEWER');
CREATE TYPE "UserAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ACCESS_REMOVED');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING_OWNER_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "AccessAuditAction" AS ENUM ('PERSON_CREATED', 'PERSON_ARCHIVED', 'ORGANIZATION_MEMBERSHIP_ADDED', 'ORGANIZATION_MEMBERSHIP_REMOVED', 'DEPARTMENT_MEMBERSHIP_CHANGED', 'TEAM_MEMBERSHIP_CHANGED', 'ACCESS_REQUESTED', 'INVITATION_APPROVED', 'INVITATION_SENT', 'INVITATION_RESENT', 'INVITATION_ACCEPTED', 'INVITATION_REJECTED', 'INVITATION_CANCELLED', 'ACCESS_LEVEL_CHANGED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_REACTIVATED', 'ACCESS_REMOVED', 'SESSIONS_REVOKED');

ALTER TYPE "WorkspaceRole" ADD VALUE 'VIEWER';

ALTER TABLE "Principal"
  ADD COLUMN "jobTitle" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "status" "PrincipalStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE "OrganizationMembership" (
  "id" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "accessLevel" "AccessLevel",
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DepartmentMembership" (
  "id" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "DepartmentMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamMembership" (
  "id" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamScope" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "departmentId" TEXT,
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "TeamScope_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthUser" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "image" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthSession" (
  "id" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "token" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL,
  CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthAccount" (
  "id" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "refreshTokenExpiresAt" TIMESTAMP(3),
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthVerification" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserAccount" (
  "id" TEXT NOT NULL,
  "authUserId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "loginEmailNormalized" TEXT NOT NULL,
  "status" "UserAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastLoginAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "accessRemovedAt" TIMESTAMP(3),
  CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invitation" (
  "id" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "emailNormalized" TEXT NOT NULL,
  "requestedAccessLevel" "AccessLevel" NOT NULL,
  "approvedAccessLevel" "AccessLevel",
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING_OWNER_APPROVAL',
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "rejectedById" TEXT,
  "rejectionReason" TEXT,
  "tokenHash" TEXT,
  "tokenVersion" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessAuditLog" (
  "id" TEXT NOT NULL,
  "actorPersonId" TEXT,
  "targetPersonId" TEXT,
  "organizationId" TEXT,
  "action" "AccessAuditAction" NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationMembership_personId_organizationId_key" ON "OrganizationMembership"("personId", "organizationId");
CREATE INDEX "OrganizationMembership_organizationId_status_accessLevel_idx" ON "OrganizationMembership"("organizationId", "status", "accessLevel");
CREATE UNIQUE INDEX "DepartmentMembership_personId_departmentId_key" ON "DepartmentMembership"("personId", "departmentId");
CREATE INDEX "DepartmentMembership_departmentId_status_idx" ON "DepartmentMembership"("departmentId", "status");
CREATE UNIQUE INDEX "TeamMembership_personId_teamId_key" ON "TeamMembership"("personId", "teamId");
CREATE INDEX "TeamMembership_teamId_status_idx" ON "TeamMembership"("teamId", "status");
CREATE UNIQUE INDEX "TeamScope_teamId_organizationId_departmentId_key" ON "TeamScope"("teamId", "organizationId", "departmentId");
CREATE INDEX "TeamScope_organizationId_departmentId_status_idx" ON "TeamScope"("organizationId", "departmentId", "status");
CREATE UNIQUE INDEX "AuthUser_email_key" ON "AuthUser"("email");
CREATE UNIQUE INDEX "AuthSession_token_key" ON "AuthSession"("token");
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");
CREATE UNIQUE INDEX "AuthAccount_issuer_accountId_key" ON "AuthAccount"("issuer", "accountId");
CREATE INDEX "AuthAccount_userId_idx" ON "AuthAccount"("userId");
CREATE INDEX "AuthVerification_identifier_idx" ON "AuthVerification"("identifier");
CREATE UNIQUE INDEX "UserAccount_authUserId_key" ON "UserAccount"("authUserId");
CREATE UNIQUE INDEX "UserAccount_personId_key" ON "UserAccount"("personId");
CREATE UNIQUE INDEX "UserAccount_loginEmailNormalized_key" ON "UserAccount"("loginEmailNormalized");
CREATE INDEX "UserAccount_personId_status_idx" ON "UserAccount"("personId", "status");
CREATE INDEX "Invitation_organizationId_status_createdAt_idx" ON "Invitation"("organizationId", "status", "createdAt");
CREATE INDEX "Invitation_personId_status_idx" ON "Invitation"("personId", "status");
CREATE INDEX "Invitation_emailNormalized_status_idx" ON "Invitation"("emailNormalized", "status");
CREATE INDEX "AccessAuditLog_organizationId_createdAt_idx" ON "AccessAuditLog"("organizationId", "createdAt");
CREATE INDEX "AccessAuditLog_targetPersonId_createdAt_idx" ON "AccessAuditLog"("targetPersonId", "createdAt");

ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Principal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Principal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepartmentMembership" ADD CONSTRAINT "DepartmentMembership_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Principal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Principal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamScope" ADD CONSTRAINT "TeamScope_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Principal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamScope" ADD CONSTRAINT "TeamScope_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamScope" ADD CONSTRAINT "TeamScope_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthAccount" ADD CONSTRAINT "AuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAccount" ADD CONSTRAINT "UserAccount_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES "AuthUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserAccount" ADD CONSTRAINT "UserAccount_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Principal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Principal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Principal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccessAuditLog" ADD CONSTRAINT "AccessAuditLog_actorPersonId_fkey" FOREIGN KEY ("actorPersonId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccessAuditLog" ADD CONSTRAINT "AccessAuditLog_targetPersonId_fkey" FOREIGN KEY ("targetPersonId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccessAuditLog" ADD CONSTRAINT "AccessAuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill active/archive state from the existing directory record.
UPDATE "Principal" SET "status" = CASE WHEN "active" THEN 'ACTIVE'::"PrincipalStatus" ELSE 'ARCHIVED'::"PrincipalStatus" END;

-- Backfill Person organization affiliation and legacy roles. Access still
-- requires an ACTIVE UserAccount, so this cannot grant login access by itself.
WITH legacy AS (
  SELECT DISTINCT ON (m."principalId", m."organizationId")
    m."principalId", m."organizationId", m."role"
  FROM "PrincipalMembership" m
  JOIN "Principal" p ON p."id" = m."principalId"
  WHERE p."type" = 'PERSON'::"PrincipalType" AND m."organizationId" IS NOT NULL
  ORDER BY m."principalId", m."organizationId",
    CASE m."role"
      WHEN 'OWNER'::"WorkspaceRole" THEN 4
      WHEN 'ORGANIZATION_MANAGER'::"WorkspaceRole" THEN 3
      WHEN 'DEPARTMENT_MANAGER'::"WorkspaceRole" THEN 2
      WHEN 'EMPLOYEE'::"WorkspaceRole" THEN 1
      ELSE 0
    END DESC
)
INSERT INTO "OrganizationMembership" ("id", "personId", "organizationId", "accessLevel", "status", "createdAt", "updatedAt")
SELECT
  'legacy-org:' || "principalId" || ':' || "organizationId",
  "principalId",
  "organizationId",
  CASE "role"
    WHEN 'OWNER'::"WorkspaceRole" THEN 'OWNER'::"AccessLevel"
    WHEN 'ORGANIZATION_MANAGER'::"WorkspaceRole" THEN 'ORGANIZATION_MANAGER'::"AccessLevel"
    WHEN 'DEPARTMENT_MANAGER'::"WorkspaceRole" THEN 'DEPARTMENT_HEAD'::"AccessLevel"
    WHEN 'VIEWER'::"WorkspaceRole" THEN 'VIEWER'::"AccessLevel"
    ELSE 'MEMBER'::"AccessLevel"
  END,
  'ACTIVE'::"MembershipStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM legacy;

-- DepartmentMembership is the canonical Person department source after this
-- migration. Team records are intentionally copied to TeamScope instead.
INSERT INTO "DepartmentMembership" ("id", "personId", "departmentId", "status", "createdAt", "updatedAt")
SELECT DISTINCT
  'legacy-department:' || m."principalId" || ':' || m."departmentId",
  m."principalId",
  m."departmentId",
  'ACTIVE'::"MembershipStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PrincipalMembership" m
JOIN "Principal" p ON p."id" = m."principalId"
WHERE p."type" = 'PERSON'::"PrincipalType" AND m."departmentId" IS NOT NULL;

INSERT INTO "TeamScope" ("id", "teamId", "organizationId", "departmentId", "status", "createdAt", "updatedAt")
SELECT DISTINCT
  'legacy-team-scope:' || m."principalId" || ':' || m."organizationId" || ':' || COALESCE(m."departmentId", 'none'),
  m."principalId",
  m."organizationId",
  m."departmentId",
  'ACTIVE'::"MembershipStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PrincipalMembership" m
JOIN "Principal" p ON p."id" = m."principalId"
WHERE p."type" = 'TEAM'::"PrincipalType" AND m."organizationId" IS NOT NULL;
