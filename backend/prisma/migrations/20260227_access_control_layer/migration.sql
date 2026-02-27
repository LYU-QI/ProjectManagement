-- Access control layer: global roles expansion + project-level memberships

-- 1) Extend UserRole enum with new role hierarchy values.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'project_director';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'project_manager';

-- 2) Create ProjectRole enum for project-level authorization.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectRole') THEN
    CREATE TYPE "ProjectRole" AS ENUM ('director', 'manager', 'member', 'viewer');
  END IF;
END $$;

-- 3) Create ProjectMembership table.
CREATE TABLE IF NOT EXISTS "ProjectMembership" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "projectId" INTEGER NOT NULL,
  "role" "ProjectRole" NOT NULL DEFAULT 'member',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProjectMembership_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 4) Add uniqueness and index to support membership lookups.
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectMembership_userId_projectId_key"
  ON "ProjectMembership"("userId", "projectId");

CREATE INDEX IF NOT EXISTS "ProjectMembership_projectId_idx"
  ON "ProjectMembership"("projectId");
