/*
  Warnings:

  - Added the required column `updatedAt` to the `Material` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FieldDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);
INSERT INTO "new_FieldDay" ("createdAt", "date", "id", "location", "notes", "title", "updatedAt") SELECT "createdAt", "date", "id", "location", "notes", "title", "updatedAt" FROM "FieldDay";
DROP TABLE "FieldDay";
ALTER TABLE "new_FieldDay" RENAME TO "FieldDay";
CREATE INDEX "FieldDay_status_deletedAt_idx" ON "FieldDay"("status", "deletedAt");
CREATE TABLE "new_Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "originalName" TEXT,
    "storedName" TEXT,
    "filePath" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "sha256" TEXT,
    "uploadStatus" TEXT NOT NULL DEFAULT 'STORED',
    "uploadError" TEXT,
    "clientUploadId" TEXT,
    "capturedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "fieldDayId" TEXT,
    CONSTRAINT "Material_fieldDayId_fkey" FOREIGN KEY ("fieldDayId") REFERENCES "FieldDay" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Material" ("capturedAt", "createdAt", "description", "fieldDayId", "filePath", "id", "title", "type") SELECT "capturedAt", "createdAt", "description", "fieldDayId", "filePath", "id", "title", "type" FROM "Material";
DROP TABLE "Material";
ALTER TABLE "new_Material" RENAME TO "Material";
CREATE UNIQUE INDEX "Material_clientUploadId_key" ON "Material"("clientUploadId");
CREATE INDEX "Material_fieldDayId_deletedAt_createdAt_idx" ON "Material"("fieldDayId", "deletedAt", "createdAt");
CREATE INDEX "Material_type_uploadStatus_idx" ON "Material"("type", "uploadStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
