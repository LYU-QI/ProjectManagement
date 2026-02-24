-- CreateTable
CREATE TABLE "PmAssistantLog" (
    "id" SERIAL NOT NULL,
    "jobId" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "rawSummary" TEXT,
    "aiSummary" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PmAssistantLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PmAssistantJobConfig" (
    "id" SERIAL NOT NULL,
    "jobId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmAssistantJobConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PmAssistantJobConfig_jobId_key" ON "PmAssistantJobConfig"("jobId");
