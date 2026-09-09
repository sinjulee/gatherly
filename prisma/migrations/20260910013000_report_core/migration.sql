PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "templateType" TEXT,
    "analysisDirection" TEXT,
    "purpose" TEXT,
    "audience" TEXT,
    "scope" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "content" TEXT,
    "currentVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "fieldDayId" TEXT,
    CONSTRAINT "Report_fieldDayId_fkey" FOREIGN KEY ("fieldDayId") REFERENCES "FieldDay" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Report_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ReportVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Report" ("id", "title", "status", "content", "updatedAt", "fieldDayId")
SELECT "id", "title",
  CASE WHEN lower("status") = 'draft' THEN 'DRAFT' WHEN lower("status") = 'completed' THEN 'COMPLETED' ELSE upper("status") END,
  "content", "updatedAt", "fieldDayId"
FROM "Report";

DROP TABLE "Report";
ALTER TABLE "new_Report" RENAME TO "Report";
CREATE INDEX "Report_fieldDayId_deletedAt_updatedAt_idx" ON "Report"("fieldDayId", "deletedAt", "updatedAt");
CREATE INDEX "Report_status_deletedAt_idx" ON "Report"("status", "deletedAt");

CREATE TABLE "ReportMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportMaterial_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReportMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReportMaterial_reportId_materialId_key" ON "ReportMaterial"("reportId", "materialId");
CREATE INDEX "ReportMaterial_reportId_selected_idx" ON "ReportMaterial"("reportId", "selected");

CREATE TABLE "ReportQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportQuestion_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReportQuestion_reportId_order_idx" ON "ReportQuestion"("reportId", "order");

CREATE TABLE "ReportAnalysisPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "objective" TEXT,
    "keyQuestions" TEXT,
    "researchRequirements" TEXT,
    "proposedSections" TEXT,
    "expectedEvidence" TEXT,
    "risks" TEXT,
    "userApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReportAnalysisPlan_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReportAnalysisPlan_reportId_key" ON "ReportAnalysisPlan"("reportId");

CREATE TABLE "ReportVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionType" TEXT NOT NULL,
    "parentVersionId" TEXT,
    "createdBy" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportVersion_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReportVersion_reportId_versionNumber_key" ON "ReportVersion"("reportId", "versionNumber");
CREATE INDEX "ReportVersion_reportId_createdAt_idx" ON "ReportVersion"("reportId", "createdAt");

CREATE TABLE "ReportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "stage" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "workspacePath" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReportJob_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReportJob_status_createdAt_idx" ON "ReportJob"("status", "createdAt");
CREATE INDEX "ReportJob_reportId_createdAt_idx" ON "ReportJob"("reportId", "createdAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
