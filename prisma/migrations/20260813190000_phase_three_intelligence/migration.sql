CREATE TYPE "WorkflowTemplateStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "NudgeDisposition" AS ENUM ('DISMISSED', 'SNOOZED');

ALTER TABLE "Project" ADD COLUMN "sourceTemplateId" TEXT;

CREATE TABLE "WorkflowTemplate" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "leadDepartmentId" TEXT,
  "createdByPrincipalId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "WorkflowTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowTemplateInvolvedDepartment" (
  "templateId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  CONSTRAINT "WorkflowTemplateInvolvedDepartment_pkey" PRIMARY KEY ("templateId", "departmentId")
);

CREATE TABLE "WorkflowTemplateTask" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "leadDepartmentId" TEXT,
  "defaultAssigneeId" TEXT,
  "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "startOffsetDays" INTEGER,
  "targetOffsetDays" INTEGER,
  "deadlineOffsetDays" INTEGER,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "WorkflowTemplateTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowTemplateChecklistItem" (
  "id" TEXT NOT NULL,
  "templateTaskId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "WorkflowTemplateChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowTemplateDependency" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "prerequisiteTemplateTaskId" TEXT NOT NULL,
  "type" "DependencyType" NOT NULL,
  "label" TEXT NOT NULL,
  CONSTRAINT "WorkflowTemplateDependency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowTemplateMilestone" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "targetOffsetDays" INTEGER,
  "ownerPrincipalId" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "WorkflowTemplateMilestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowTemplateFocusItem" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "WorkflowTemplateFocusItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkNudge" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "taskId" TEXT,
  "dedupKey" TEXT NOT NULL,
  "disposition" "NudgeDisposition" NOT NULL,
  "snoozedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkNudge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowTemplate_workspaceId_name_key" ON "WorkflowTemplate"("workspaceId", "name");
CREATE INDEX "WorkflowTemplate_workspaceId_status_idx" ON "WorkflowTemplate"("workspaceId", "status");
CREATE INDEX "WorkflowTemplate_organizationId_idx" ON "WorkflowTemplate"("organizationId");
CREATE INDEX "WorkflowTemplateInvolvedDepartment_departmentId_templateId_idx" ON "WorkflowTemplateInvolvedDepartment"("departmentId", "templateId");
CREATE UNIQUE INDEX "WorkflowTemplateTask_templateId_position_key" ON "WorkflowTemplateTask"("templateId", "position");
CREATE INDEX "WorkflowTemplateTask_templateId_leadDepartmentId_idx" ON "WorkflowTemplateTask"("templateId", "leadDepartmentId");
CREATE UNIQUE INDEX "WorkflowTemplateChecklistItem_templateTaskId_position_key" ON "WorkflowTemplateChecklistItem"("templateTaskId", "position");
CREATE UNIQUE INDEX "WorkflowTemplateDependency_taskId_prerequisiteTemplateTaskId_type_key" ON "WorkflowTemplateDependency"("taskId", "prerequisiteTemplateTaskId", "type");
CREATE INDEX "WorkflowTemplateDependency_prerequisiteTemplateTaskId_idx" ON "WorkflowTemplateDependency"("prerequisiteTemplateTaskId");
CREATE UNIQUE INDEX "WorkflowTemplateMilestone_templateId_position_key" ON "WorkflowTemplateMilestone"("templateId", "position");
CREATE UNIQUE INDEX "WorkflowTemplateFocusItem_templateId_position_key" ON "WorkflowTemplateFocusItem"("templateId", "position");
CREATE UNIQUE INDEX "WorkNudge_workspaceId_recipientId_dedupKey_key" ON "WorkNudge"("workspaceId", "recipientId", "dedupKey");
CREATE INDEX "WorkNudge_workspaceId_recipientId_disposition_idx" ON "WorkNudge"("workspaceId", "recipientId", "disposition");
CREATE INDEX "WorkNudge_taskId_idx" ON "WorkNudge"("taskId");
CREATE INDEX "Project_sourceTemplateId_idx" ON "Project"("sourceTemplateId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "WorkflowTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_leadDepartmentId_fkey" FOREIGN KEY ("leadDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_createdByPrincipalId_fkey" FOREIGN KEY ("createdByPrincipalId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplateInvolvedDepartment" ADD CONSTRAINT "WorkflowTemplateInvolvedDepartment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplateInvolvedDepartment" ADD CONSTRAINT "WorkflowTemplateInvolvedDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplateTask" ADD CONSTRAINT "WorkflowTemplateTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplateTask" ADD CONSTRAINT "WorkflowTemplateTask_leadDepartmentId_fkey" FOREIGN KEY ("leadDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplateTask" ADD CONSTRAINT "WorkflowTemplateTask_defaultAssigneeId_fkey" FOREIGN KEY ("defaultAssigneeId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplateChecklistItem" ADD CONSTRAINT "WorkflowTemplateChecklistItem_templateTaskId_fkey" FOREIGN KEY ("templateTaskId") REFERENCES "WorkflowTemplateTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplateDependency" ADD CONSTRAINT "WorkflowTemplateDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkflowTemplateTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplateDependency" ADD CONSTRAINT "WorkflowTemplateDependency_prerequisiteTemplateTaskId_fkey" FOREIGN KEY ("prerequisiteTemplateTaskId") REFERENCES "WorkflowTemplateTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplateMilestone" ADD CONSTRAINT "WorkflowTemplateMilestone_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplateMilestone" ADD CONSTRAINT "WorkflowTemplateMilestone_ownerPrincipalId_fkey" FOREIGN KEY ("ownerPrincipalId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplateFocusItem" ADD CONSTRAINT "WorkflowTemplateFocusItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkNudge" ADD CONSTRAINT "WorkNudge_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkNudge" ADD CONSTRAINT "WorkNudge_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Principal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkNudge" ADD CONSTRAINT "WorkNudge_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
