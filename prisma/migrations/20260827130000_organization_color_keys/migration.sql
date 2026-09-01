-- Add a semantic visual identity without changing organization IDs, projects,
-- memberships, or any existing work. The UI maps these keys to theme tokens.
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "colorKey" TEXT;

-- Keep the established Binnie organizations recognisable, then use each
-- organization's stable primary key for a deterministic fallback.
UPDATE "Organization"
SET "colorKey" = CASE lower(trim("name"))
  WHEN 'villa khayangan' THEN 'lavender'
  WHEN 'apotik' THEN 'mint'
  WHEN 'curug cidulang' THEN 'butter'
  WHEN 'personal' THEN 'peach'
  ELSE CASE (abs(hashtext("id")::bigint) % 6)
    WHEN 0 THEN 'powderBlue'
    WHEN 1 THEN 'sage'
    WHEN 2 THEN 'lavender'
    WHEN 3 THEN 'mint'
    WHEN 4 THEN 'butter'
    ELSE 'peach'
  END
END
WHERE "colorKey" IS NULL OR "colorKey" = '';

ALTER TABLE "Organization"
  ALTER COLUMN "colorKey" SET DEFAULT 'powderBlue',
  ALTER COLUMN "colorKey" SET NOT NULL;
