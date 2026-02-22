-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('FS', 'SS', 'FF');

-- CreateTable
CREATE TABLE "FeishuDependency" (
    "id" SERIAL NOT NULL,
    "projectName" TEXT NOT NULL,
    "taskRecordId" TEXT NOT NULL,
    "taskId" TEXT,
    "dependsOnRecordId" TEXT NOT NULL,
    "dependsOnTaskId" TEXT,
    "type" "DependencyType" NOT NULL DEFAULT 'FS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeishuDependency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeishuDependency_taskRecordId_dependsOnRecordId_type_key" ON "FeishuDependency"("taskRecordId", "dependsOnRecordId", "type");
