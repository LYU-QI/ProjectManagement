-- AlterTable
ALTER TABLE "PmAssistantLog" ADD COLUMN "projectId" INTEGER;

-- CreateTable
CREATE TABLE "PmAssistantProjectJobConfig" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmAssistantProjectJobConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PmAssistantProjectPrompt" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "jobId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmAssistantProjectPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PmAssistantProjectSchedule" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "cron" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmAssistantProjectSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PmAssistantProjectJobConfig_projectId_idx" ON "PmAssistantProjectJobConfig"("projectId");
CREATE UNIQUE INDEX "PmAssistantProjectJobConfig_projectId_jobId_key" ON "PmAssistantProjectJobConfig"("projectId", "jobId");

CREATE INDEX "PmAssistantProjectPrompt_projectId_idx" ON "PmAssistantProjectPrompt"("projectId");
CREATE UNIQUE INDEX "PmAssistantProjectPrompt_projectId_jobId_key" ON "PmAssistantProjectPrompt"("projectId", "jobId");

CREATE INDEX "PmAssistantProjectSchedule_projectId_idx" ON "PmAssistantProjectSchedule"("projectId");
CREATE UNIQUE INDEX "PmAssistantProjectSchedule_projectId_scheduleId_key" ON "PmAssistantProjectSchedule"("projectId", "scheduleId");

CREATE INDEX "PmAssistantLog_projectId_idx" ON "PmAssistantLog"("projectId");

-- AddForeignKey
ALTER TABLE "PmAssistantLog"
  ADD CONSTRAINT "PmAssistantLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PmAssistantProjectJobConfig"
  ADD CONSTRAINT "PmAssistantProjectJobConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PmAssistantProjectPrompt"
  ADD CONSTRAINT "PmAssistantProjectPrompt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PmAssistantProjectSchedule"
  ADD CONSTRAINT "PmAssistantProjectSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
