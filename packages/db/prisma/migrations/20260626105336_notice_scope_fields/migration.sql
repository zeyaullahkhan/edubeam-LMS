-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Notice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL DEFAULT 'school',
    "schoolId" TEXT,
    "blockId" TEXT,
    "districtId" TEXT,
    "tenantId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'General',
    "publishDate" TEXT NOT NULL,
    "expiryDate" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Notice_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Notice" ("createdAt", "createdById", "createdByName", "description", "expiryDate", "id", "publishDate", "schoolId", "title", "type", "updatedAt") SELECT "createdAt", "createdById", "createdByName", "description", "expiryDate", "id", "publishDate", "schoolId", "title", "type", "updatedAt" FROM "Notice";
DROP TABLE "Notice";
ALTER TABLE "new_Notice" RENAME TO "Notice";
CREATE INDEX "Notice_schoolId_publishDate_idx" ON "Notice"("schoolId", "publishDate");
CREATE INDEX "Notice_blockId_publishDate_idx" ON "Notice"("blockId", "publishDate");
CREATE INDEX "Notice_districtId_publishDate_idx" ON "Notice"("districtId", "publishDate");
CREATE INDEX "Notice_tenantId_publishDate_idx" ON "Notice"("tenantId", "publishDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
