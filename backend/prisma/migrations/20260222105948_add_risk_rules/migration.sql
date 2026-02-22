-- CreateTable
CREATE TABLE "RiskRule" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "thresholdDays" INTEGER NOT NULL,
    "progressThreshold" INTEGER NOT NULL,
    "includeMilestones" BOOLEAN NOT NULL DEFAULT false,
    "autoNotify" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAlert" (
    "id" SERIAL NOT NULL,
    "ruleId" INTEGER NOT NULL,
    "recordId" TEXT NOT NULL,
    "taskId" TEXT,
    "taskName" TEXT,
    "project" TEXT,
    "endDate" TEXT,
    "progress" DOUBLE PRECISION,
    "daysLeft" INTEGER,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiskRule_key_key" ON "RiskRule"("key");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAlert_ruleId_recordId_key" ON "RiskAlert"("ruleId", "recordId");

-- AddForeignKey
ALTER TABLE "RiskAlert" ADD CONSTRAINT "RiskAlert_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "RiskRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
