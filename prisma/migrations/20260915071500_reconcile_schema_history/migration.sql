-- Reconcile schema objects that were previously applied outside Prisma Migrate.
-- Existing databases that already match schema.prisma must mark this migration
-- as applied with `prisma migrate resolve --applied`; do not execute it there.

-- AlterTable
ALTER TABLE "FieldDay" ADD COLUMN "driveProjectFolderId" TEXT;
ALTER TABLE "FieldDay" ADD COLUMN "driveProjectFolderUrl" TEXT;
ALTER TABLE "FieldDay" ADD COLUMN "driveWorkspaceLastScannedAt" DATETIME;
ALTER TABLE "FieldDay" ADD COLUMN "driveWorkspaceLinkedAt" DATETIME;

-- CreateTable
CREATE TABLE "QuickAnalysisJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldDayId" TEXT NOT NULL,
    "analysisBriefId" TEXT,
    "title" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "resultMarkdown" TEXT,
    "outputPath" TEXT,
    "errorMessageSafe" TEXT,
    "queuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuickAnalysisJob_fieldDayId_fkey" FOREIGN KEY ("fieldDayId") REFERENCES "FieldDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuickAnalysisJob_analysisBriefId_fkey" FOREIGN KEY ("analysisBriefId") REFERENCES "AnalysisBrief" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldDayId" TEXT NOT NULL,
    "parentPlanId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "background" TEXT,
    "visitPurpose" TEXT,
    "decisionContext" TEXT,
    "targetScope" TEXT,
    "successCriteria" TEXT,
    "preResearchText" TEXT,
    "generatedByAi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "activatedAt" DATETIME,
    "closedAt" DATETIME,
    CONSTRAINT "ResearchPlan_fieldDayId_fkey" FOREIGN KEY ("fieldDayId") REFERENCES "FieldDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResearchPlan_parentPlanId_fkey" FOREIGN KEY ("parentPlanId") REFERENCES "ResearchPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researchPlanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "boothNo" TEXT,
    "locationHint" TEXT,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'P2',
    "visitOrder" INTEGER NOT NULL DEFAULT 0,
    "visitStatus" TEXT NOT NULL DEFAULT 'PLANNED',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchTarget_researchPlanId_fkey" FOREIGN KEY ("researchPlanId") REFERENCES "ResearchPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researchPlanId" TEXT NOT NULL,
    "targetId" TEXT,
    "question" TEXT NOT NULL,
    "rationale" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'P2',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchQuestion_researchPlanId_fkey" FOREIGN KEY ("researchPlanId") REFERENCES "ResearchPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResearchQuestion_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "ResearchTarget" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchCheckpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researchPlanId" TEXT NOT NULL,
    "targetId" TEXT,
    "researchQuestionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'P2',
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "evidenceRequirement" TEXT,
    "completionNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchCheckpoint_researchPlanId_fkey" FOREIGN KEY ("researchPlanId") REFERENCES "ResearchPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResearchCheckpoint_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "ResearchTarget" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ResearchCheckpoint_researchQuestionId_fkey" FOREIGN KEY ("researchQuestionId") REFERENCES "ResearchQuestion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequiredEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkpointId" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL DEFAULT 'ANY',
    "minimumCount" INTEGER NOT NULL DEFAULT 1,
    "requireText" BOOLEAN NOT NULL DEFAULT false,
    "requireFile" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RequiredEvidence_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "ResearchCheckpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PreResearchSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldDayId" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT,
    "webViewLink" TEXT,
    "modifiedTime" DATETIME,
    "sourceType" TEXT NOT NULL DEFAULT 'OTHER',
    "selectedForPlan" BOOLEAN NOT NULL DEFAULT false,
    "contentHash" TEXT,
    "lastScannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PreResearchSource_fieldDayId_fkey" FOREIGN KEY ("fieldDayId") REFERENCES "FieldDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "QuickAnalysisJob_fieldDayId_queuedAt_idx" ON "QuickAnalysisJob"("fieldDayId", "queuedAt");

-- CreateIndex
CREATE INDEX "QuickAnalysisJob_status_queuedAt_idx" ON "QuickAnalysisJob"("status", "queuedAt");

-- CreateIndex
CREATE INDEX "QuickAnalysisJob_analysisBriefId_idx" ON "QuickAnalysisJob"("analysisBriefId");

-- CreateIndex
CREATE INDEX "ResearchPlan_fieldDayId_status_idx" ON "ResearchPlan"("fieldDayId", "status");

-- CreateIndex
CREATE INDEX "ResearchPlan_fieldDayId_isActive_idx" ON "ResearchPlan"("fieldDayId", "isActive");

-- CreateIndex
CREATE INDEX "ResearchPlan_parentPlanId_idx" ON "ResearchPlan"("parentPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchPlan_fieldDayId_version_key" ON "ResearchPlan"("fieldDayId", "version");

-- CreateIndex
CREATE INDEX "ResearchTarget_researchPlanId_visitOrder_idx" ON "ResearchTarget"("researchPlanId", "visitOrder");

-- CreateIndex
CREATE INDEX "ResearchTarget_researchPlanId_visitStatus_idx" ON "ResearchTarget"("researchPlanId", "visitStatus");

-- CreateIndex
CREATE INDEX "ResearchQuestion_researchPlanId_sortOrder_idx" ON "ResearchQuestion"("researchPlanId", "sortOrder");

-- CreateIndex
CREATE INDEX "ResearchQuestion_targetId_idx" ON "ResearchQuestion"("targetId");

-- CreateIndex
CREATE INDEX "ResearchCheckpoint_researchPlanId_sortOrder_idx" ON "ResearchCheckpoint"("researchPlanId", "sortOrder");

-- CreateIndex
CREATE INDEX "ResearchCheckpoint_targetId_idx" ON "ResearchCheckpoint"("targetId");

-- CreateIndex
CREATE INDEX "ResearchCheckpoint_researchQuestionId_idx" ON "ResearchCheckpoint"("researchQuestionId");

-- CreateIndex
CREATE INDEX "ResearchCheckpoint_researchPlanId_priority_status_idx" ON "ResearchCheckpoint"("researchPlanId", "priority", "status");

-- CreateIndex
CREATE INDEX "RequiredEvidence_checkpointId_idx" ON "RequiredEvidence"("checkpointId");

-- CreateIndex
CREATE INDEX "PreResearchSource_fieldDayId_selectedForPlan_idx" ON "PreResearchSource"("fieldDayId", "selectedForPlan");

-- CreateIndex
CREATE INDEX "PreResearchSource_fieldDayId_modifiedTime_idx" ON "PreResearchSource"("fieldDayId", "modifiedTime");

-- CreateIndex
CREATE UNIQUE INDEX "PreResearchSource_fieldDayId_driveFileId_key" ON "PreResearchSource"("fieldDayId", "driveFileId");

-- CreateIndex
CREATE INDEX "FieldDay_driveProjectFolderId_idx" ON "FieldDay"("driveProjectFolderId");
