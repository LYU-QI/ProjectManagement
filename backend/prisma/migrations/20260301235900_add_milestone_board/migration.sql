-- CreateEnum
CREATE TYPE "MilestoneBoardStatus" AS ENUM ('upcoming', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "MilestoneBoardRisk" AS ENUM ('low', 'medium', 'high');

-- CreateTable
CREATE TABLE "MilestoneBoardItem" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "due" TEXT NOT NULL,
    "status" "MilestoneBoardStatus" NOT NULL DEFAULT 'upcoming',
    "risk" "MilestoneBoardRisk" NOT NULL DEFAULT 'low',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilestoneBoardItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneBoardDeliverable" (
    "id" SERIAL NOT NULL,
    "milestoneId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilestoneBoardDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MilestoneBoardItem_projectId_status_due_idx" ON "MilestoneBoardItem"("projectId", "status", "due");

-- CreateIndex
CREATE INDEX "MilestoneBoardItem_projectId_sortOrder_idx" ON "MilestoneBoardItem"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "MilestoneBoardDeliverable_milestoneId_sortOrder_idx" ON "MilestoneBoardDeliverable"("milestoneId", "sortOrder");

-- AddForeignKey
ALTER TABLE "MilestoneBoardItem" ADD CONSTRAINT "MilestoneBoardItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneBoardDeliverable" ADD CONSTRAINT "MilestoneBoardDeliverable_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "MilestoneBoardItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
