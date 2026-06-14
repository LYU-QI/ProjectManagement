CREATE TABLE IF NOT EXISTS "ProjectWeeklyBugMetricSnapshot" (
  "id" SERIAL PRIMARY KEY,
  "projectId" INTEGER NOT NULL,
  "snapshotDate" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "totalIssues" INTEGER NOT NULL DEFAULT 0,
  "solvedIssues" INTEGER NOT NULL DEFAULT 0,
  "pendingIssues" INTEGER NOT NULL DEFAULT 0,
  "totalP0Issues" INTEGER NOT NULL DEFAULT 0,
  "adjustedTotalP0Issues" INTEGER NOT NULL DEFAULT 0,
  "pendingP0Issues" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProjectWeeklyBugMetricSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectWeeklyBugMetricSnapshot_projectId_snapshotDate_key" ON "ProjectWeeklyBugMetricSnapshot"("projectId", "snapshotDate");
CREATE INDEX IF NOT EXISTS "ProjectWeeklyBugMetricSnapshot_projectId_idx" ON "ProjectWeeklyBugMetricSnapshot"("projectId");
