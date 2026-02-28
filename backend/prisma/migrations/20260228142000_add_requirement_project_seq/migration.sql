-- Add project-level requirement sequence number (projectSeq)
ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "projectSeq" INTEGER;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "id") AS seq
  FROM "Requirement"
)
UPDATE "Requirement" r
SET "projectSeq" = ranked.seq
FROM ranked
WHERE r."id" = ranked."id";

ALTER TABLE "Requirement"
  ALTER COLUMN "projectSeq" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Requirement_projectId_projectSeq_key"
  ON "Requirement"("projectId", "projectSeq");
