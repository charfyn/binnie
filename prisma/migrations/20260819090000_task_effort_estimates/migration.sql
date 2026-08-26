-- Optional task effort fields. This is additive and preserves every existing
-- task and its relationships; absent estimates remain NULL rather than 0.
ALTER TABLE "Task" ADD COLUMN "estimatedMinutes" INTEGER;
ALTER TABLE "Task" ADD COLUMN "actualMinutes" INTEGER;
