-- Phase 2 workflow records remain attached to canonical tasks rather than
-- becoming client-only cards. Existing tasks stay valid and simply have no
-- parent, recurrence, or checklist until those features are used.
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'MONTHS');

ALTER TABLE "Task"
  ADD COLUMN "parentTaskId" TEXT,
  ADD COLUMN "sourceTaskId" TEXT,
  ADD COLUMN "recurrenceId" TEXT,
  ADD COLUMN "mergedIntoTaskId" TEXT;

CREATE TABLE "TaskChecklistItem" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "completedByPrincipalId" TEXT,
  CONSTRAINT "TaskChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskRecurrence" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "frequency" "RecurrenceFrequency" NOT NULL,
  "interval" INTEGER NOT NULL DEFAULT 1,
  "weekDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "monthDay" INTEGER,
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "nextOccurrenceDate" DATE,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskRecurrence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedView" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "ownerId" TEXT,
  "name" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");
CREATE INDEX "Task_sourceTaskId_idx" ON "Task"("sourceTaskId");
CREATE INDEX "Task_recurrenceId_idx" ON "Task"("recurrenceId");
CREATE UNIQUE INDEX "TaskChecklistItem_taskId_position_key" ON "TaskChecklistItem"("taskId", "position");
CREATE INDEX "TaskChecklistItem_taskId_completedAt_idx" ON "TaskChecklistItem"("taskId", "completedAt");
CREATE INDEX "TaskRecurrence_workspaceId_active_nextOccurrenceDate_idx" ON "TaskRecurrence"("workspaceId", "active", "nextOccurrenceDate");
CREATE UNIQUE INDEX "SavedView_workspaceId_name_key" ON "SavedView"("workspaceId", "name");
CREATE INDEX "SavedView_workspaceId_ownerId_idx" ON "SavedView"("workspaceId", "ownerId");

ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_sourceTaskId_fkey" FOREIGN KEY ("sourceTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "TaskRecurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_completedByPrincipalId_fkey" FOREIGN KEY ("completedByPrincipalId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskRecurrence" ADD CONSTRAINT "TaskRecurrence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Principal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
