-- Make Gatherly reports versioned and API-ready for PlanFrame integration.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Report" (
    "report_id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "content" TEXT,
    "report_version" INTEGER NOT NULL DEFAULT 1,
    "structured_result" TEXT,
    "structured_schema_version" TEXT NOT NULL DEFAULT 'gatherly.report.v1',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "fieldDayId" TEXT,
    CONSTRAINT "Report_fieldDayId_fkey" FOREIGN KEY ("fieldDayId") REFERENCES "FieldDay" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Report" (
    "report_id",
    "title",
    "status",
    "content",
    "report_version",
    "structured_result",
    "structured_schema_version",
    "createdAt",
    "updatedAt",
    "fieldDayId"
)
SELECT
    "id",
    "title",
    "status",
    "content",
    1,
    NULL,
    'gatherly.report.v1',
    CURRENT_TIMESTAMP,
    "updatedAt",
    "fieldDayId"
FROM "Report";

DROP TABLE "Report";
ALTER TABLE "new_Report" RENAME TO "Report";

CREATE INDEX "Report_fieldDayId_updatedAt_idx" ON "Report"("fieldDayId", "updatedAt");
CREATE INDEX "Report_status_updatedAt_idx" ON "Report"("status", "updatedAt");

CREATE TABLE "ReportVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "report_version" INTEGER NOT NULL,
    "versionType" TEXT NOT NULL DEFAULT 'DRAFT',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "content" TEXT,
    "structured_result" TEXT,
    "structured_schema_version" TEXT NOT NULL DEFAULT 'gatherly.report.v1',
    "createdBy" TEXT NOT NULL DEFAULT 'SYSTEM',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportVersion_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("report_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Preserve existing report content as version 1 snapshots.
INSERT INTO "ReportVersion" (
    "id",
    "reportId",
    "report_version",
    "versionType",
    "status",
    "content",
    "structured_result",
    "structured_schema_version",
    "createdBy",
    "createdAt"
)
SELECT
    'rv_' || lower(hex(randomblob(16))),
    "report_id",
    1,
    'LEGACY_IMPORT',
    upper("status"),
    "content",
    "structured_result",
    "structured_schema_version",
    'MIGRATION',
    CURRENT_TIMESTAMP
FROM "Report";

CREATE UNIQUE INDEX "ReportVersion_reportId_report_version_key" ON "ReportVersion"("reportId", "report_version");
CREATE INDEX "ReportVersion_reportId_createdAt_idx" ON "ReportVersion"("reportId", "createdAt");

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
    CONSTRAINT "ReportIntegrationDelivery_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("report_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReportIntegrationDelivery_reportVersionId_fkey" FOREIGN KEY ("reportVersionId") REFERENCES "ReportVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReportIntegrationDelivery_idempotencyKey_key" ON "ReportIntegrationDelivery"("idempotencyKey");
CREATE INDEX "ReportIntegrationDelivery_reportId_destination_status_idx" ON "ReportIntegrationDelivery"("reportId", "destination", "status");
CREATE INDEX "ReportIntegrationDelivery_reportVersionId_destination_idx" ON "ReportIntegrationDelivery"("reportVersionId", "destination");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
