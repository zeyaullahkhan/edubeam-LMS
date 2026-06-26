/*
  Warnings:

  - You are about to drop the column `schoolId` on the `AcademicYear` table. All the data in the column will be lost.
  - You are about to drop the column `schoolId` on the `Subject` table. All the data in the column will be lost.
  - Added the required column `tenantId` to the `AcademicYear` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Subject` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AcademicYear" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AcademicYear_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AcademicYear" ("createdAt", "endDate", "id", "isCurrent", "label", "startDate") SELECT "createdAt", "endDate", "id", "isCurrent", "label", "startDate" FROM "AcademicYear";
DROP TABLE "AcademicYear";
ALTER TABLE "new_AcademicYear" RENAME TO "AcademicYear";
CREATE INDEX "AcademicYear_tenantId_isCurrent_idx" ON "AcademicYear"("tenantId", "isCurrent");
CREATE UNIQUE INDEX "AcademicYear_tenantId_label_key" ON "AcademicYear"("tenantId", "label");
CREATE TABLE "new_Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "grade" INTEGER,
    "stream" TEXT,
    "maxMarks" REAL NOT NULL DEFAULT 100,
    "isElective" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Subject" ("code", "createdAt", "grade", "id", "isActive", "isElective", "maxMarks", "name", "stream") SELECT "code", "createdAt", "grade", "id", "isActive", "isElective", "maxMarks", "name", "stream" FROM "Subject";
DROP TABLE "Subject";
ALTER TABLE "new_Subject" RENAME TO "Subject";
CREATE INDEX "Subject_tenantId_isActive_idx" ON "Subject"("tenantId", "isActive");
CREATE UNIQUE INDEX "Subject_tenantId_name_grade_key" ON "Subject"("tenantId", "name", "grade");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
