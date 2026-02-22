-- CreateEnum
CREATE TYPE "RiskRuleType" AS ENUM ('deadline_progress', 'blocked', 'overdue');

-- AlterTable
ALTER TABLE "RiskRule" ADD COLUMN     "blockedValue" TEXT DEFAULT '是',
ADD COLUMN     "type" "RiskRuleType" NOT NULL DEFAULT 'deadline_progress';

-- CreateTable
CREATE TABLE "RiskRuleLog" (
    "id" SERIAL NOT NULL,
    "ruleId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskRuleLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RiskRuleLog" ADD CONSTRAINT "RiskRuleLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "RiskRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
