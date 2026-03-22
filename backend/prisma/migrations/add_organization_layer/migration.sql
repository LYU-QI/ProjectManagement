-- Phase 1 Task 1: Add Organization multi-tenant layer
-- Create enum values
DO $$ BEGIN
  CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrgRole" AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create Organization table
CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "plan" "Plan" NOT NULL DEFAULT 'FREE',
  "maxMembers" INTEGER NOT NULL DEFAULT 25,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- Create default organization
INSERT INTO "Organization" ("id", "slug", "name", "plan", "maxMembers", "createdAt", "updatedAt")
VALUES ('default', 'default', 'Default Organization', 'PRO', 100, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Create OrgMember table
CREATE TABLE "OrgMember" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "organizationId" TEXT NOT NULL,
  "orgRole" "OrgRole" NOT NULL DEFAULT 'member',
  "departmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrgMember_userId_organizationId_key" UNIQUE ("userId", "organizationId")
);

CREATE INDEX "OrgMember_organizationId_idx" ON "OrgMember"("organizationId");
CREATE INDEX "OrgMember_userId_idx" ON "OrgMember"("userId");

ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create Config table
CREATE TABLE "Config" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Config_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Config_organizationId_key" UNIQUE ("organizationId", "key")
);

CREATE INDEX "Config_organizationId_idx" ON "Config"("organizationId");

ALTER TABLE "Config" ADD CONSTRAINT "Config_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add multi-tenant fields to User
ALTER TABLE "User" ADD COLUMN "feishuOpenId" TEXT;
ALTER TABLE "User" ADD COLUMN "feishuUnionId" TEXT;
ALTER TABLE "User" ADD COLUMN "defaultOrgId" TEXT;

-- Add organizationId to Project (non-nullable, assign existing to default org)
ALTER TABLE "Project" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default';
UPDATE "Project" SET "organizationId" = 'default' WHERE "organizationId" IS NULL;
ALTER TABLE "Project" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");

-- Add organizationId to ProjectMembership
ALTER TABLE "ProjectMembership" ADD COLUMN "organizationId" TEXT;
CREATE INDEX "ProjectMembership_organizationId_idx" ON "ProjectMembership"("organizationId");

-- Add organizationId to AuditLog
ALTER TABLE "AuditLog" ADD COLUMN "organizationId" TEXT;
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- Add organizationId to FeishuUser
ALTER TABLE "FeishuUser" ADD COLUMN "organizationId" TEXT;
DROP INDEX IF EXISTS "FeishuUser_name_key";
CREATE UNIQUE INDEX "FeishuUser_organizationId_name_key" ON "FeishuUser"("organizationId", "name");
CREATE INDEX "FeishuUser_organizationId_idx" ON "FeishuUser"("organizationId");

-- Add organizationId to RiskRule
ALTER TABLE "RiskRule" ADD COLUMN "organizationId" TEXT;
DROP INDEX IF EXISTS "RiskRule_key_key";
CREATE UNIQUE INDEX "RiskRule_organizationId_key_key" ON "RiskRule"("organizationId", "key");
CREATE INDEX "RiskRule_organizationId_idx" ON "RiskRule"("organizationId");

-- Add organizationId to FeishuDependency
ALTER TABLE "FeishuDependency" ADD COLUMN "organizationId" TEXT;
CREATE INDEX "FeishuDependency_organizationId_idx" ON "FeishuDependency"("organizationId");
