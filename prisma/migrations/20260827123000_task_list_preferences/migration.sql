-- Additive, personal display preference only. Canonical tasks, assignments,
-- organizations, and existing workspace data are deliberately untouched.
ALTER TABLE "PrincipalPreference"
  ADD COLUMN IF NOT EXISTS "taskListColumns" JSONB;
