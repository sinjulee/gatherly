-- CreateTable
CREATE TABLE "Exhibition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "venue" TEXT,
    "location" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "country" TEXT,
    "location" TEXT,
    "founded" INTEGER,
    "website" TEXT,
    "websiteDomain" TEXT,
    "companySummary" TEXT,
    "businessType" TEXT,
    "companySize" TEXT,
    "mainProductsJson" TEXT,
    "flagshipProduct" TEXT,
    "productSummary" TEXT,
    "targetCustomerJson" TEXT,
    "customerExamplesJson" TEXT,
    "businessModel" TEXT,
    "coreTechnology" TEXT,
    "aiDigital" TEXT,
    "competitiveAdvantage" TEXT,
    "competitorsJson" TEXT,
    "domesticMarket" TEXT,
    "globalMarket" TEXT,
    "growthSignals" TEXT,
    "funding" TEXT,
    "revenue" TEXT,
    "certificationsJson" TEXT,
    "recentNews" TEXT,
    "recentNewsDate" DATETIME,
    "source" TEXT,
    "lastChecked" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExhibitionCompany" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exhibitionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "externalCompanyId" TEXT,
    "booth" TEXT,
    "industry" TEXT,
    "category" TEXT,
    "exhibitionFocus" TEXT,
    "whyInteresting" TEXT,
    "benchmarkPoint" TEXT,
    "collaborationOpportunity" TEXT,
    "fieldObservation" TEXT,
    "questionsJson" TEXT,
    "riskOrUnknown" TEXT,
    "rawTagsJson" TEXT,
    "source" TEXT,
    "lastChecked" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExhibitionCompany_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "Exhibition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExhibitionCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "FieldDay"
ADD COLUMN "exhibitionId" TEXT REFERENCES "Exhibition" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Exhibition_status_startDate_idx" ON "Exhibition"("status", "startDate");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE INDEX "Company_websiteDomain_idx" ON "Company"("websiteDomain");

-- CreateIndex
CREATE INDEX "ExhibitionCompany_exhibitionId_idx" ON "ExhibitionCompany"("exhibitionId");

-- CreateIndex
CREATE INDEX "ExhibitionCompany_companyId_idx" ON "ExhibitionCompany"("companyId");

-- CreateIndex
CREATE INDEX "ExhibitionCompany_booth_idx" ON "ExhibitionCompany"("booth");

-- CreateIndex
CREATE UNIQUE INDEX "ExhibitionCompany_exhibitionId_companyId_key" ON "ExhibitionCompany"("exhibitionId", "companyId");

-- CreateIndex
CREATE INDEX "FieldDay_exhibitionId_idx" ON "FieldDay"("exhibitionId");
