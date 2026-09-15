-- Nullable evidence context. SQLite supports column-level REFERENCES on nullable ADD COLUMN,
-- avoiding Prisma's Material table copy/drop/redefinition and preserving all existing rows.
ALTER TABLE "Material" ADD COLUMN "companyId" TEXT REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Material" ADD COLUMN "sourceIndexId" TEXT REFERENCES "CurationIndex"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Material_companyId_deletedAt_createdAt_idx" ON "Material"("companyId", "deletedAt", "createdAt");
CREATE INDEX "Material_sourceIndexId_idx" ON "Material"("sourceIndexId");
