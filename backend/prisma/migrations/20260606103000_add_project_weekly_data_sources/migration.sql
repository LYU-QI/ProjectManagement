CREATE TABLE IF NOT EXISTS "ProjectWeeklyDataSource" (
  "id" SERIAL PRIMARY KEY,
  "projectId" INTEGER NOT NULL,
  "sourceType" TEXT NOT NULL,
  "appToken" TEXT,
  "tableId" TEXT,
  "viewId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectWeeklyDataSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectWeeklyDataSource_projectId_sourceType_key" ON "ProjectWeeklyDataSource"("projectId", "sourceType");
CREATE INDEX IF NOT EXISTS "ProjectWeeklyDataSource_projectId_idx" ON "ProjectWeeklyDataSource"("projectId");
