-- CreateTable
CREATE TABLE "RequirementChange" (
    "id" SERIAL NOT NULL,
    "requirementId" INTEGER NOT NULL,
    "changedBy" TEXT,
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "version" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementChange_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RequirementChange" ADD CONSTRAINT "RequirementChange_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
