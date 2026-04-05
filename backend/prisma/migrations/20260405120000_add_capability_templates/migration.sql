CREATE TABLE "CapabilityTemplate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "projectId" INTEGER,
  "scene" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "systemPrompt" TEXT,
  "userPromptTemplate" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CapabilityTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CapabilityTemplate_organizationId_scene_enabled_idx"
ON "CapabilityTemplate"("organizationId", "scene", "enabled");

CREATE INDEX "CapabilityTemplate_projectId_scene_enabled_idx"
ON "CapabilityTemplate"("projectId", "scene", "enabled");

CREATE UNIQUE INDEX "CapabilityTemplate_organizationId_projectId_scene_name_key"
ON "CapabilityTemplate"("organizationId", "projectId", "scene", "name");

ALTER TABLE "CapabilityTemplate"
ADD CONSTRAINT "CapabilityTemplate_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CapabilityTemplate"
ADD CONSTRAINT "CapabilityTemplate_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
