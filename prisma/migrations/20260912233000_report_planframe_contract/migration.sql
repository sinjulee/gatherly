-- Integrate Gatherly final reports, NotebookLM report versions,
-- structured_result, and PlanFrame delivery tracking.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- ---------------------------------------------------------
-- Report
-- ---------------------------------------------------------

CREATE TABLE "new_Report" (
    "report_id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "content" TEXT,
    "instruction" TEXT,
    "report_version" INTEGER NOT NULL DEFAULT 1,
    "structured_result" TEXT,
    "structured_schema_version" TEXT NOT NULL DEFAULT 'gatherly.report.v1',
    "parentReportId" TEXT,
    "googleDocId" TEXT,
    "outputPath" TEXT,
    "errorMessageSafe" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    "fieldDayId" TEXT,

    CONSTRAINT "Report_fieldDayId_fkey"
      FOREIGN KEY ("fieldDayId")
      REFERENCES "FieldDay" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE,

    CONSTRAINT "Report_parentReportId_fkey"
      FOREIGN KEY ("parentReportId")
      REFERENCES "new_Report" ("report_id")
      ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Report" (
    "report_id",
    "title",
    "status",
    "content",
    "instruction",
    "report_version",
    "structured_result",
    "structured_schema_version",
    "parentReportId",
    "googleDocId",
    "outputPath",
    "errorMessageSafe",
    "createdAt",
    "startedAt",
    "completedAt",
    "updatedAt",
    "fieldDayId"
)
SELECT
    "id",
    "title",
    "status",
    "content",
    "instruction",
    "version",
    NULL,
    'gatherly.report.v1',
    "parentReportId",
    "googleDocId",
    "outputPath",
    "errorMessageSafe",
    "createdAt",
    "startedAt",
    "completedAt",
    "updatedAt",
    "fieldDayId"
FROM "Report";

DROP TABLE "Report";
ALTER TABLE "new_Report" RENAME TO "Report";

CREATE INDEX "Report_fieldDayId_createdAt_idx"
ON "Report"("fieldDayId", "createdAt");

CREATE INDEX "Report_status_createdAt_idx"
ON "Report"("status", "createdAt");

CREATE INDEX "Report_parentReportId_idx"
ON "Report"("parentReportId");


-- ---------------------------------------------------------
-- ReportVersion
-- Existing NotebookLM ReportVersion is expanded rather
-- than replaced conceptually.
-- ---------------------------------------------------------

CREATE TABLE "new_ReportVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,

    "reportId" TEXT,
    "report_version" INTEGER,
    "versionType" TEXT NOT NULL DEFAULT 'DRAFT',
    "content" TEXT,
    "structured_result" TEXT,
    "structured_schema_version" TEXT NOT NULL DEFAULT 'gatherly.report.v1',
    "createdBy" TEXT NOT NULL DEFAULT 'SYSTEM',

    "researchResultId" TEXT,
    "versionNo" INTEGER,
    "title" TEXT,
    "googleDocId" TEXT,
    "localSnapshotPath" TEXT,
    "revisionReason" TEXT,

    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportVersion_reportId_fkey"
      FOREIGN KEY ("reportId")
      REFERENCES "Report" ("report_id")
      ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "ReportVersion_researchResultId_fkey"
      FOREIGN KEY ("researchResultId")
      REFERENCES "ResearchResult" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

-- Preserve NotebookLM research report versions.
INSERT INTO "new_ReportVersion" (
    "id",
    "researchResultId",
    "versionNo",
    "title",
    "googleDocId",
    "localSnapshotPath",
    "revisionReason",
    "status",
    "createdAt",
    "versionType",
    "structured_schema_version",
    "createdBy"
)
SELECT
    "id",
    "researchResultId",
    "versionNo",
    "title",
    "googleDocId",
    "localSnapshotPath",
    "revisionReason",
    "status",
    "createdAt",
    'DRAFT',
    'gatherly.report.v1',
    'NOTEBOOKLM_MIGRATION'
FROM "ReportVersion";

DROP TABLE "ReportVersion";
ALTER TABLE "new_ReportVersion" RENAME TO "ReportVersion";

CREATE UNIQUE INDEX "ReportVersion_reportId_report_version_key"
ON "ReportVersion"("reportId", "report_version");

CREATE UNIQUE INDEX "ReportVersion_researchResultId_versionNo_key"
ON "ReportVersion"("researchResultId", "versionNo");

CREATE INDEX "ReportVersion_reportId_createdAt_idx"
ON "ReportVersion"("reportId", "createdAt");

CREATE INDEX "ReportVersion_researchResultId_createdAt_idx"
ON "ReportVersion"("researchResultId", "createdAt");

CREATE INDEX "ReportVersion_status_idx"
ON "ReportVersion"("status");


-- ---------------------------------------------------------
-- Preserve existing Report rows as version snapshots.
-- ---------------------------------------------------------

INSERT INTO "ReportVersion" (
    "id",
    "reportId",
    "report_version",
    "versionType",
    "content",
    "structured_result",
    "structured_schema_version",
    "createdBy",
    "status",
    "createdAt",
    "title"
)
SELECT
    'rv_' || lower(hex(randomblob(16))),
    "report_id",
    "report_version",
    'LEGACY_IMPORT',
    "content",
    "structured_result",
    "structured_schema_version",
    'MIGRATION',
    upper("status"),
    "createdAt",
    "title"
FROM "Report";


-- ---------------------------------------------------------
-- PlanFrame delivery audit
-- ---------------------------------------------------------

CREATE TABLE "ReportIntegrationDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "reportVersionId" TEXT NOT NULL,
    "destination" TEXT NOT NULL DEFAULT 'PLANFRAME',
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "payloadHash" TEXT,
    "httpStatus" INTEGER,
    "externalReportId" TEXT,
    "sentAt" DATETIME,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    CONSTRAINT "ReportIntegrationDelivery_reportId_fkey"
      FOREIGN KEY ("reportId")
      REFERENCES "Report" ("report_id")
      ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "ReportIntegrationDelivery_reportVersionId_fkey"
      FOREIGN KEY ("reportVersionId")
      REFERENCES "ReportVersion" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReportIntegrationDelivery_idempotencyKey_key"
ON "ReportIntegrationDelivery"("idempotencyKey");

CREATE INDEX "ReportIntegrationDelivery_reportId_destination_status_idx"
ON "ReportIntegrationDelivery"("reportId", "destination", "status");

CREATE INDEX "ReportIntegrationDelivery_reportVersionId_destination_idx"
ON "ReportIntegrationDelivery"("reportVersionId", "destination");


PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
