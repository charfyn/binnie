-- Phase 2 task responsibility: Owner is accountability, while the existing
-- normalized TaskAssignment PRIMARY_OWNER row remains the current operational
-- responsibility internally. No Task IDs or relationships are replaced.
ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "ownerPrincipalId" TEXT,
  ADD COLUMN IF NOT EXISTS "ownerInferredFromCreator" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "currentStep" TEXT;

-- Creator is a conservative inferred default for existing records. It is not
-- subsequently treated as synonymous with Owner: authorized users can edit
-- ownership through the canonical action.
UPDATE "Task" AS task
SET "ownerPrincipalId" = creator."id",
    "ownerInferredFromCreator" = TRUE
FROM "Principal" AS creator
WHERE task."ownerPrincipalId" IS NULL
  AND task."createdByPrincipalId" = creator."id"
  AND creator."type" = 'PERSON';

-- Preserve a single current-responsibility assignment for legacy work without
-- copying Tasks. Explicit existing primary assignments always win. When no
-- primary exists, a recorded next-action recipient is the least ambiguous
-- operational fallback; otherwise an unassigned Person-created task stays
-- with its creator. Tasks with only collaborators and no such signal remain
-- unassigned for an authorized person to route deliberately.
UPDATE "TaskAssignment" AS assignment
SET "role" = 'PRIMARY_OWNER'
FROM "Task" AS task
JOIN "Principal" AS recipient ON recipient."id" = task."nextActionPrincipalId"
WHERE assignment."taskId" = task."id"
  AND assignment."principalId" = recipient."id"
  AND task."nextActionKind" = 'PRINCIPAL'
  AND NOT EXISTS (
    SELECT 1 FROM "TaskAssignment" current_assignment
    WHERE current_assignment."taskId" = task."id"
      AND current_assignment."role" = 'PRIMARY_OWNER'
  );

INSERT INTO "TaskAssignment" ("id", "taskId", "principalId", "role", "source", "assignedAt", "assignedByPrincipalId")
SELECT
  'responsibility-' || md5(task."id" || ':' || recipient."id"),
  task."id",
  recipient."id",
  'PRIMARY_OWNER',
  'IMPORT',
  CURRENT_TIMESTAMP,
  NULL
FROM "Task" AS task
JOIN "Principal" AS recipient ON recipient."id" = task."nextActionPrincipalId"
WHERE task."nextActionKind" = 'PRINCIPAL'
  AND NOT EXISTS (
    SELECT 1 FROM "TaskAssignment" current_assignment
    WHERE current_assignment."taskId" = task."id"
      AND current_assignment."role" = 'PRIMARY_OWNER'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "TaskAssignment" matching_assignment
    WHERE matching_assignment."taskId" = task."id"
      AND matching_assignment."principalId" = recipient."id"
  )
ON CONFLICT ("taskId", "principalId") DO NOTHING;

UPDATE "TaskAssignment" AS assignment
SET "role" = 'PRIMARY_OWNER'
FROM "Task" AS task
JOIN "Principal" AS creator ON creator."id" = task."createdByPrincipalId" AND creator."type" = 'PERSON'
WHERE assignment."taskId" = task."id"
  AND assignment."principalId" = creator."id"
  AND NOT EXISTS (
    SELECT 1 FROM "TaskAssignment" current_assignment
    WHERE current_assignment."taskId" = task."id"
      AND current_assignment."role" = 'PRIMARY_OWNER'
  );

INSERT INTO "TaskAssignment" ("id", "taskId", "principalId", "role", "source", "assignedAt", "assignedByPrincipalId")
SELECT
  'responsibility-' || md5(task."id" || ':' || creator."id"),
  task."id",
  creator."id",
  'PRIMARY_OWNER',
  'IMPORT',
  CURRENT_TIMESTAMP,
  NULL
FROM "Task" AS task
JOIN "Principal" AS creator ON creator."id" = task."createdByPrincipalId" AND creator."type" = 'PERSON'
WHERE NOT EXISTS (
  SELECT 1 FROM "TaskAssignment" current_assignment
  WHERE current_assignment."taskId" = task."id"
    AND current_assignment."role" = 'PRIMARY_OWNER'
)
  AND NOT EXISTS (
    SELECT 1 FROM "TaskAssignment" matching_assignment
    WHERE matching_assignment."taskId" = task."id"
      AND matching_assignment."principalId" = creator."id"
  )
ON CONFLICT ("taskId", "principalId") DO NOTHING;

-- Some early imports permitted more than one compatibility PRIMARY_OWNER.
-- Keep the earliest recorded recipient as the one operational queue owner and
-- preserve every other relationship as collaboration context instead of
-- deleting it. A partial unique index makes the invariant durable afterwards.
WITH ranked_current_responsibilities AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "taskId"
    ORDER BY "assignedAt" ASC, "id" ASC
  ) AS position
  FROM "TaskAssignment"
  WHERE "role" = 'PRIMARY_OWNER'
)
UPDATE "TaskAssignment" AS assignment
SET "role" = 'COLLABORATOR'
FROM ranked_current_responsibilities AS ranked
WHERE assignment."id" = ranked."id"
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "TaskAssignment_one_current_responsibility"
  ON "TaskAssignment"("taskId")
  WHERE "role" = 'PRIMARY_OWNER';

CREATE INDEX IF NOT EXISTS "Task_ownerPrincipalId_idx" ON "Task"("ownerPrincipalId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Task_ownerPrincipalId_fkey'
  ) THEN
    ALTER TABLE "Task"
      ADD CONSTRAINT "Task_ownerPrincipalId_fkey"
      FOREIGN KEY ("ownerPrincipalId") REFERENCES "Principal"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
