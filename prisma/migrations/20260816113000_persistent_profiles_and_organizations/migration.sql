-- Durable user preferences and organization metadata.  This migration only
-- adds nullable/defaulted fields and never rewrites existing workspace data.
ALTER TABLE "Organization" ADD COLUMN "description" TEXT;

CREATE TABLE "PrincipalPreference" (
  "principalId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  "dateFormat" TEXT NOT NULL DEFAULT '12 Aug 2026',
  "theme" TEXT NOT NULL DEFAULT 'soft',
  "storageVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrincipalPreference_pkey" PRIMARY KEY ("principalId")
);

CREATE INDEX "PrincipalPreference_workspaceId_idx" ON "PrincipalPreference"("workspaceId");

ALTER TABLE "PrincipalPreference"
  ADD CONSTRAINT "PrincipalPreference_principalId_fkey"
  FOREIGN KEY ("principalId") REFERENCES "Principal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrincipalPreference"
  ADD CONSTRAINT "PrincipalPreference_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
