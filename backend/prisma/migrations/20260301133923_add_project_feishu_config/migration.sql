-- DropForeignKey
ALTER TABLE "PmAssistantProjectJobConfig" DROP CONSTRAINT "PmAssistantProjectJobConfig_projectId_fkey";

-- DropForeignKey
ALTER TABLE "PmAssistantProjectPrompt" DROP CONSTRAINT "PmAssistantProjectPrompt_projectId_fkey";

-- DropForeignKey
ALTER TABLE "PmAssistantProjectSchedule" DROP CONSTRAINT "PmAssistantProjectSchedule_projectId_fkey";

-- DropIndex
DROP INDEX "PmAssistantLog_projectId_idx";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "feishuAppToken" TEXT,
ADD COLUMN     "feishuTableId" TEXT;

-- AlterTable
ALTER TABLE "ProjectMembership" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "PmAssistantProjectJobConfig" ADD CONSTRAINT "PmAssistantProjectJobConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmAssistantProjectPrompt" ADD CONSTRAINT "PmAssistantProjectPrompt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PmAssistantProjectSchedule" ADD CONSTRAINT "PmAssistantProjectSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
