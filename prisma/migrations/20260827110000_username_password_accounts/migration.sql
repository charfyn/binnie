-- Additive username/password credential migration. It deliberately preserves
-- all Persons, memberships, tasks, projects, legacy magic-link records, and
-- Better Auth sessions. Do not use prisma migrate reset for this migration.

ALTER TYPE "AccessAuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_CREATED';
ALTER TYPE "AccessAuditAction" ADD VALUE IF NOT EXISTS 'USERNAME_CHANGED';
ALTER TYPE "AccessAuditAction" ADD VALUE IF NOT EXISTS 'PASSWORD_RESET';
ALTER TYPE "AccessAuditAction" ADD VALUE IF NOT EXISTS 'PASSWORD_CHANGED';

ALTER TABLE "UserAccount"
  ADD COLUMN "username" TEXT,
  ADD COLUMN "usernameNormalized" TEXT,
  ADD COLUMN "requiresPasswordChange" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "temporaryPasswordExpiresAt" TIMESTAMP(3),
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- Existing magic-link users are retained unchanged. Their email is now an
-- optional legacy/contact identity rather than a required login credential.
ALTER TABLE "UserAccount"
  ALTER COLUMN "loginEmailNormalized" DROP NOT NULL;

ALTER TABLE "Invitation"
  ALTER COLUMN "emailNormalized" DROP NOT NULL,
  ADD COLUMN "requestedUsername" TEXT,
  ADD COLUMN "requestedUsernameNormalized" TEXT,
  ADD COLUMN "approvedUsername" TEXT,
  ADD COLUMN "approvedUsernameNormalized" TEXT;

-- Existing accounts remain without a username until an explicit, stable-ID
-- bootstrap or an Owner-controlled account update assigns one. This avoids
-- inferring an identity from a name or baking a workspace-specific ID into a
-- reusable migration.

CREATE UNIQUE INDEX "UserAccount_usernameNormalized_key" ON "UserAccount"("usernameNormalized");
CREATE INDEX "UserAccount_usernameNormalized_status_idx" ON "UserAccount"("usernameNormalized", "status");
CREATE INDEX "Invitation_requestedUsernameNormalized_status_idx" ON "Invitation"("requestedUsernameNormalized", "status");

CREATE TABLE "AuthRateLimit" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  "lastRequest" BIGINT NOT NULL,
  CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuthRateLimit_key_key" ON "AuthRateLimit"("key");

CREATE TABLE "CredentialLoginThrottle" (
  "id" TEXT NOT NULL,
  "usernameNormalized" TEXT NOT NULL,
  "ipAddressHash" TEXT NOT NULL,
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "blockedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CredentialLoginThrottle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CredentialLoginThrottle_usernameNormalized_ipAddressHash_key" ON "CredentialLoginThrottle"("usernameNormalized", "ipAddressHash");
CREATE INDEX "CredentialLoginThrottle_blockedUntil_idx" ON "CredentialLoginThrottle"("blockedUntil");
