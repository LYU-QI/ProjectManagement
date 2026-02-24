-- CreateTable
CREATE TABLE "PrdDocument" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrdDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrdVersion" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "versionLabel" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "storagePath" TEXT NOT NULL,
    "contentText" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrdVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrdDocument_projectId_idx" ON "PrdDocument"("projectId");

-- CreateIndex
CREATE INDEX "PrdVersion_documentId_idx" ON "PrdVersion"("documentId");

-- CreateIndex
CREATE INDEX "PrdVersion_contentHash_idx" ON "PrdVersion"("contentHash");

-- AddForeignKey
ALTER TABLE "PrdDocument" ADD CONSTRAINT "PrdDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrdVersion" ADD CONSTRAINT "PrdVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PrdDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
