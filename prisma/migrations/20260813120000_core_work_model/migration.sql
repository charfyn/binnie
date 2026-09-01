-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ORGANIZATION_MANAGER', 'DEPARTMENT_MANAGER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "PrincipalType" AS ENUM ('PERSON', 'TEAM');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('READY', 'IN_PROGRESS', 'WAITING', 'BLOCKED', 'REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "AssignmentRole" AS ENUM ('PRIMARY_OWNER', 'COLLABORATOR');

-- CreateEnum
CREATE TYPE "AssignmentSource" AS ENUM ('MANUAL', 'DEPARTMENT_ROUTING', 'SMART_INBOX', 'CLAIM', 'IMPORT');

-- CreateEnum
CREATE TYPE "NextActionKind" AS ENUM ('PRINCIPAL', 'DEPARTMENT', 'EXTERNAL', 'READY');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('START_BLOCKER', 'COMPLETION_BLOCKER', 'RELATED');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "ResourceScope" AS ENUM ('TASK', 'PROJECT', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "CaptureStatus" AS ENUM ('NEEDS_ORGANIZATION', 'REVIEWING', 'CONFIRMED', 'UNDONE');

-- CreateEnum
CREATE TYPE "TaskEventType" AS ENUM ('CREATED', 'TITLE_CHANGED', 'ORGANIZATION_CHANGED', 'LEAD_DEPARTMENT_CHANGED', 'INVOLVED_DEPARTMENTS_CHANGED', 'ASSIGNED', 'CLAIMED', 'REASSIGNED', 'NEXT_ACTION_CHANGED', 'DATES_CHANGED', 'STATUS_CHANGED', 'WAITING_MARKED', 'BLOCKED_MARKED', 'DEPENDENCY_CHANGED', 'UPDATE_POSTED', 'REVIEW_SUBMITTED', 'REVIEW_APPROVED', 'REVISION_REQUESTED', 'COMPLETED', 'REOPENED', 'ARCHIVED', 'IMPORTED');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Principal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "PrincipalType" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Principal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrincipalMembership" (
    "id" TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    "organizationId" TEXT,
    "departmentId" TEXT,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'EMPLOYEE',

    CONSTRAINT "PrincipalMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT,
    "leadDepartmentId" TEXT,
    "projectId" TEXT,
    "createdByPrincipalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'READY',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "startDate" DATE,
    "targetDate" DATE,
    "deadline" DATE,
    "followUpDate" DATE,
    "waitingSince" TIMESTAMP(3),
    "nextActionKind" "NextActionKind" NOT NULL DEFAULT 'READY',
    "nextActionPrincipalId" TEXT,
    "nextActionDepartmentId" TEXT,
    "nextActionExternalLabel" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "legacyLocalId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskInvolvedDepartment" (
    "taskId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "TaskInvolvedDepartment_pkey" PRIMARY KEY ("taskId","departmentId")
);

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    "role" "AssignmentRole" NOT NULL DEFAULT 'COLLABORATOR',
    "source" "AssignmentSource" NOT NULL DEFAULT 'MANUAL',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByPrincipalId" TEXT,
    "claimedFromAssignmentId" TEXT,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "prerequisiteTaskId" TEXT,
    "ownerPrincipalId" TEXT,
    "ownerDepartmentId" TEXT,
    "type" "DependencyType" NOT NULL,
    "label" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskReviewCycle" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "submittedByPrincipalId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewerPrincipalId" TEXT,
    "reviewedByPrincipalId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decision" "ReviewDecision",
    "revisionNote" TEXT,

    CONSTRAINT "TaskReviewCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskUpdate" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskResource" (
    "id" TEXT NOT NULL,
    "scope" "ResourceScope" NOT NULL,
    "taskId" TEXT,
    "projectId" TEXT,
    "organizationId" TEXT,
    "updateId" TEXT,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "content" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "TaskEventType" NOT NULL,
    "summary" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxCapture" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT,
    "rawText" TEXT NOT NULL,
    "status" "CaptureStatus" NOT NULL DEFAULT 'REVIEWING',
    "candidates" JSONB,
    "confirmationKey" TEXT,
    "undoExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptureTask" (
    "captureId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,

    CONSTRAINT "CaptureTask_pkey" PRIMARY KEY ("captureId","taskId")
);

-- CreateTable
CREATE TABLE "LegacyImport" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedCount" INTEGER NOT NULL,

    CONSTRAINT "LegacyImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_workspaceId_name_key" ON "Organization"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_name_key" ON "Department"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Project_organizationId_name_key" ON "Project"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Principal_workspaceId_name_key" ON "Principal"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "PrincipalMembership_principalId_organizationId_departmentId_idx" ON "PrincipalMembership"("principalId", "organizationId", "departmentId");

-- CreateIndex
CREATE INDEX "Task_workspaceId_status_archivedAt_deletedAt_idx" ON "Task"("workspaceId", "status", "archivedAt", "deletedAt");

-- CreateIndex
CREATE INDEX "Task_organizationId_leadDepartmentId_idx" ON "Task"("organizationId", "leadDepartmentId");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_workspaceId_legacyLocalId_key" ON "Task"("workspaceId", "legacyLocalId");

-- CreateIndex
CREATE INDEX "TaskInvolvedDepartment_departmentId_taskId_idx" ON "TaskInvolvedDepartment"("departmentId", "taskId");

-- CreateIndex
CREATE INDEX "TaskAssignment_principalId_role_idx" ON "TaskAssignment"("principalId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskId_principalId_key" ON "TaskAssignment"("taskId", "principalId");

-- CreateIndex
CREATE INDEX "TaskDependency_taskId_type_resolvedAt_idx" ON "TaskDependency"("taskId", "type", "resolvedAt");

-- CreateIndex
CREATE INDEX "TaskDependency_prerequisiteTaskId_idx" ON "TaskDependency"("prerequisiteTaskId");

-- CreateIndex
CREATE INDEX "TaskReviewCycle_taskId_reviewedAt_idx" ON "TaskReviewCycle"("taskId", "reviewedAt");

-- CreateIndex
CREATE INDEX "TaskUpdate_taskId_createdAt_idx" ON "TaskUpdate"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskResource_taskId_scope_idx" ON "TaskResource"("taskId", "scope");

-- CreateIndex
CREATE INDEX "TaskResource_updateId_idx" ON "TaskResource"("updateId");

-- CreateIndex
CREATE INDEX "TaskEvent_taskId_createdAt_idx" ON "TaskEvent"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "InboxCapture_workspaceId_status_idx" ON "InboxCapture"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LegacyImport_workspaceId_fingerprint_key" ON "LegacyImport"("workspaceId", "fingerprint");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Principal" ADD CONSTRAINT "Principal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrincipalMembership" ADD CONSTRAINT "PrincipalMembership_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "Principal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrincipalMembership" ADD CONSTRAINT "PrincipalMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrincipalMembership" ADD CONSTRAINT "PrincipalMembership_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadDepartmentId_fkey" FOREIGN KEY ("leadDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdByPrincipalId_fkey" FOREIGN KEY ("createdByPrincipalId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_nextActionPrincipalId_fkey" FOREIGN KEY ("nextActionPrincipalId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_nextActionDepartmentId_fkey" FOREIGN KEY ("nextActionDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskInvolvedDepartment" ADD CONSTRAINT "TaskInvolvedDepartment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskInvolvedDepartment" ADD CONSTRAINT "TaskInvolvedDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "Principal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_assignedByPrincipalId_fkey" FOREIGN KEY ("assignedByPrincipalId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_claimedFromAssignmentId_fkey" FOREIGN KEY ("claimedFromAssignmentId") REFERENCES "TaskAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_prerequisiteTaskId_fkey" FOREIGN KEY ("prerequisiteTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_ownerPrincipalId_fkey" FOREIGN KEY ("ownerPrincipalId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_ownerDepartmentId_fkey" FOREIGN KEY ("ownerDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReviewCycle" ADD CONSTRAINT "TaskReviewCycle_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReviewCycle" ADD CONSTRAINT "TaskReviewCycle_submittedByPrincipalId_fkey" FOREIGN KEY ("submittedByPrincipalId") REFERENCES "Principal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReviewCycle" ADD CONSTRAINT "TaskReviewCycle_reviewerPrincipalId_fkey" FOREIGN KEY ("reviewerPrincipalId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReviewCycle" ADD CONSTRAINT "TaskReviewCycle_reviewedByPrincipalId_fkey" FOREIGN KEY ("reviewedByPrincipalId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUpdate" ADD CONSTRAINT "TaskUpdate_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskUpdate" ADD CONSTRAINT "TaskUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Principal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskResource" ADD CONSTRAINT "TaskResource_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskResource" ADD CONSTRAINT "TaskResource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskResource" ADD CONSTRAINT "TaskResource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskResource" ADD CONSTRAINT "TaskResource_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "TaskUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskEvent" ADD CONSTRAINT "TaskEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxCapture" ADD CONSTRAINT "InboxCapture_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxCapture" ADD CONSTRAINT "InboxCapture_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptureTask" ADD CONSTRAINT "CaptureTask_captureId_fkey" FOREIGN KEY ("captureId") REFERENCES "InboxCapture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptureTask" ADD CONSTRAINT "CaptureTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegacyImport" ADD CONSTRAINT "LegacyImport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
