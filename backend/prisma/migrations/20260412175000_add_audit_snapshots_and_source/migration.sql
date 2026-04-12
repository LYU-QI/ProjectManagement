ALTER TABLE "AuditLog"
ADD COLUMN IF NOT EXISTS "source" TEXT,
ADD COLUMN IF NOT EXISTS "beforeSnapshot" JSONB,
ADD COLUMN IF NOT EXISTS "afterSnapshot" JSONB;

CREATE INDEX IF NOT EXISTS "AuditLog_source_idx" ON "AuditLog"("source");
