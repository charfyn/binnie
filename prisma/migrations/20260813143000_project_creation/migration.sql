-- Canonical projects: a project is shared work context, not a frontend card.
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "ProjectMemberRole" AS ENUM ('OWNER', 'MEMBER', 'COLLABORATOR');
CREATE TYPE "MilestoneStatus" AS ENUM ('PLANNED', 'DONE');

ALTER TABLE "Project"
  ADD COLUMN "workspaceId" TEXT,
  ADD COLUMN "leadDepartmentId" TEXT,
  ADD COLUMN "targetDate" DATE,
  ADD COLUMN "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "createdByPrincipalId" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Project" AS project
SET "workspaceId" = organization."workspaceId"
FROM "Organization" AS organization
WHERE project."organizationId" = organization."id";

ALTER TABLE "Project" ALTER COLUMN "workspaceId" SET NOT NULL;

CREATE TABLE "ProjectInvolvedDepartment" (
  "projectId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  CONSTRAINT "ProjectInvolvedDepartment_pkey" PRIMARY KEY ("projectId", "departmentId")
);

CREATE TABLE "ProjectMember" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "principalId" TEXT NOT NULL,
  "role" "ProjectMemberRole" NOT NULL DEFAULT 'MEMBER',
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectMilestone" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "targetDate" DATE,
  "status" "MilestoneStatus" NOT NULL DEFAULT 'PLANNED',
  "ownerPrincipalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectFocusItem" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectFocusItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Project_workspaceId_status_idx" ON "Project"("workspaceId", "status");
CREATE INDEX "Project_leadDepartmentId_idx" ON "Project"("leadDepartmentId");
CREATE INDEX "ProjectInvolvedDepartment_departmentId_projectId_idx" ON "ProjectInvolvedDepartment"("departmentId", "projectId");
CREATE UNIQUE INDEX "ProjectMember_projectId_principalId_key" ON "ProjectMember"("projectId", "principalId");
CREATE INDEX "ProjectMember_principalId_role_idx" ON "ProjectMember"("principalId", "role");
CREATE INDEX "ProjectMilestone_projectId_targetDate_idx" ON "ProjectMilestone"("projectId", "targetDate");
CREATE UNIQUE INDEX "ProjectFocusItem_projectId_position_key" ON "ProjectFocusItem"("projectId", "position");

ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_leadDepartmentId_fkey" FOREIGN KEY ("leadDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdByPrincipalId_fkey" FOREIGN KEY ("createdByPrincipalId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectInvolvedDepartment" ADD CONSTRAINT "ProjectInvolvedDepartment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectInvolvedDepartment" ADD CONSTRAINT "ProjectInvolvedDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "Principal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_ownerPrincipalId_fkey" FOREIGN KEY ("ownerPrincipalId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectFocusItem" ADD CONSTRAINT "ProjectFocusItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
