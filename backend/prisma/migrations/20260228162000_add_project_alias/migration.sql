ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "alias" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Project_alias_key" ON "Project"("alias");
