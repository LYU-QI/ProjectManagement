DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'AuditOutcome'
  ) THEN
    CREATE TYPE "AuditOutcome" AS ENUM ('success', 'failed');
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AuditOutcome' AND e.enumlabel = 'failure'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AuditOutcome' AND e.enumlabel = 'failed'
  ) THEN
    ALTER TYPE "AuditOutcome" RENAME VALUE 'failure' TO 'failed';
  END IF;
END
$$;

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "outcome" "AuditOutcome" NOT NULL DEFAULT 'success';

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "statusCode" INTEGER;

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "resourceType" TEXT;

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "resourceId" TEXT;

CREATE INDEX IF NOT EXISTS "AuditLog_outcome_idx" ON "AuditLog"("outcome");
CREATE INDEX IF NOT EXISTS "AuditLog_resourceType_idx" ON "AuditLog"("resourceType");
