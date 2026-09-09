-- Extend existing Material records for Research Inbox curation.
ALTER TABLE "Material" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'COLLECTED';
ALTER TABLE "Material" ADD COLUMN "tagsJson" TEXT;
ALTER TABLE "Material" ADD COLUMN "isImportant" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Material_reviewStatus_deletedAt_idx" ON "Material"("reviewStatus", "deletedAt");

-- CreateTable
CREATE TABLE "SourceBundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldDayId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "manifestJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SourceBundle_fieldDayId_fkey" FOREIGN KEY ("fieldDayId") REFERENCES "FieldDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SourceBundle_fieldDayId_version_key" ON "SourceBundle"("fieldDayId", "version");
CREATE INDEX "SourceBundle_fieldDayId_status_idx" ON "SourceBundle"("fieldDayId", "status");

-- CreateTable
CREATE TABLE "SourceBundleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceBundleId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "sourceType" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "included" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "SourceBundleItem_sourceBundleId_fkey" FOREIGN KEY ("sourceBundleId") REFERENCES "SourceBundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SourceBundleItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SourceBundleItem_sourceBundleId_materialId_key" ON "SourceBundleItem"("sourceBundleId", "materialId");
CREATE INDEX "SourceBundleItem_materialId_idx" ON "SourceBundleItem"("materialId");

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceBundleId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "localPath" TEXT,
    "driveFileId" TEXT,
    "checksum" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SourceDocument_sourceBundleId_fkey" FOREIGN KEY ("sourceBundleId") REFERENCES "SourceBundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SourceDocument_sourceBundleId_documentType_key" ON "SourceDocument"("sourceBundleId", "documentType");
CREATE INDEX "SourceDocument_syncStatus_idx" ON "SourceDocument"("syncStatus");

-- CreateTable
CREATE TABLE "AnalysisBrief" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldDayId" TEXT NOT NULL,
    "sourceBundleId" TEXT,
    "parentBriefId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "researchQuestions" TEXT,
    "decisionContext" TEXT,
    "evaluationCriteria" TEXT,
    "targetScope" TEXT,
    "excludeScope" TEXT,
    "outputType" TEXT,
    "additionalInstruction" TEXT,
    "driveFileId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AnalysisBrief_fieldDayId_fkey" FOREIGN KEY ("fieldDayId") REFERENCES "FieldDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnalysisBrief_sourceBundleId_fkey" FOREIGN KEY ("sourceBundleId") REFERENCES "SourceBundle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AnalysisBrief_parentBriefId_fkey" FOREIGN KEY ("parentBriefId") REFERENCES "AnalysisBrief" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "AnalysisBrief_fieldDayId_status_idx" ON "AnalysisBrief"("fieldDayId", "status");
CREATE INDEX "AnalysisBrief_sourceBundleId_idx" ON "AnalysisBrief"("sourceBundleId");
CREATE INDEX "AnalysisBrief_parentBriefId_idx" ON "AnalysisBrief"("parentBriefId");

-- CreateTable
CREATE TABLE "NotebookLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldDayId" TEXT NOT NULL,
    "notebookUrl" TEXT NOT NULL,
    "notebookLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotebookLink_fieldDayId_fkey" FOREIGN KEY ("fieldDayId") REFERENCES "FieldDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NotebookLink_fieldDayId_key" ON "NotebookLink"("fieldDayId");

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldDayId" TEXT NOT NULL,
    "sourceBundleId" TEXT,
    "analysisBriefId" TEXT,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessageSafe" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SyncJob_fieldDayId_fkey" FOREIGN KEY ("fieldDayId") REFERENCES "FieldDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SyncJob_sourceBundleId_fkey" FOREIGN KEY ("sourceBundleId") REFERENCES "SourceBundle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SyncJob_analysisBriefId_fkey" FOREIGN KEY ("analysisBriefId") REFERENCES "AnalysisBrief" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "SyncJob_fieldDayId_status_idx" ON "SyncJob"("fieldDayId", "status");
CREATE INDEX "SyncJob_sourceBundleId_idx" ON "SyncJob"("sourceBundleId");
CREATE INDEX "SyncJob_analysisBriefId_idx" ON "SyncJob"("analysisBriefId");

-- CreateTable
CREATE TABLE "ResearchResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldDayId" TEXT NOT NULL,
    "sourceBundleId" TEXT NOT NULL,
    "analysisBriefId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "googleDocId" TEXT,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'IMPORTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "ResearchResult_fieldDayId_fkey" FOREIGN KEY ("fieldDayId") REFERENCES "FieldDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResearchResult_sourceBundleId_fkey" FOREIGN KEY ("sourceBundleId") REFERENCES "SourceBundle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResearchResult_analysisBriefId_fkey" FOREIGN KEY ("analysisBriefId") REFERENCES "AnalysisBrief" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ResearchResult_fieldDayId_status_idx" ON "ResearchResult"("fieldDayId", "status");
CREATE INDEX "ResearchResult_sourceBundleId_idx" ON "ResearchResult"("sourceBundleId");
CREATE INDEX "ResearchResult_analysisBriefId_idx" ON "ResearchResult"("analysisBriefId");

-- CreateTable
CREATE TABLE "ReportVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researchResultId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "googleDocId" TEXT,
    "localSnapshotPath" TEXT,
    "revisionReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportVersion_researchResultId_fkey" FOREIGN KEY ("researchResultId") REFERENCES "ResearchResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReportVersion_researchResultId_versionNo_key" ON "ReportVersion"("researchResultId", "versionNo");
CREATE INDEX "ReportVersion_status_idx" ON "ReportVersion"("status");

-- CreateTable
CREATE TABLE "RevisionRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportVersionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "RevisionRequest_reportVersionId_fkey" FOREIGN KEY ("reportVersionId") REFERENCES "ReportVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "RevisionRequest_reportVersionId_status_idx" ON "RevisionRequest"("reportVersionId", "status");
