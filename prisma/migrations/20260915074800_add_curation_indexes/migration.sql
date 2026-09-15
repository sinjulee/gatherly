-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CompanyTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyTag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanyTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurationIndex" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exhibitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "indexType" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isDynamic" BOOLEAN NOT NULL DEFAULT false,
    "ruleJson" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CurationIndex_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "Exhibition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanyIndex" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "indexId" TEXT NOT NULL,
    "reason" TEXT,
    "priority" INTEGER,
    "sortOrder" INTEGER,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompanyIndex_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanyIndex_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "CurationIndex" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Tag_kind_idx" ON "Tag"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_kind_key" ON "Tag"("name", "kind");

-- CreateIndex
CREATE INDEX "CompanyTag_companyId_idx" ON "CompanyTag"("companyId");

-- CreateIndex
CREATE INDEX "CompanyTag_tagId_idx" ON "CompanyTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyTag_companyId_tagId_key" ON "CompanyTag"("companyId", "tagId");

-- CreateIndex
CREATE INDEX "CurationIndex_exhibitionId_idx" ON "CurationIndex"("exhibitionId");

-- CreateIndex
CREATE INDEX "CurationIndex_indexType_idx" ON "CurationIndex"("indexType");

-- CreateIndex
CREATE UNIQUE INDEX "CurationIndex_exhibitionId_name_key" ON "CurationIndex"("exhibitionId", "name");

-- CreateIndex
CREATE INDEX "CompanyIndex_indexId_idx" ON "CompanyIndex"("indexId");

-- CreateIndex
CREATE INDEX "CompanyIndex_companyId_idx" ON "CompanyIndex"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyIndex_companyId_indexId_key" ON "CompanyIndex"("companyId", "indexId");
