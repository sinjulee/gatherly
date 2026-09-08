CREATE TABLE "FieldDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "filePath" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fieldDayId" TEXT,
    CONSTRAINT "Material_fieldDayId_fkey" FOREIGN KEY ("fieldDayId") REFERENCES "FieldDay" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "content" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "fieldDayId" TEXT,
    CONSTRAINT "Report_fieldDayId_fkey" FOREIGN KEY ("fieldDayId") REFERENCES "FieldDay" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
