-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'school',
    "blockId" TEXT,
    "districtId" TEXT,
    "tenantId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "section" TEXT,
    "academicYear" TEXT NOT NULL,
    "dueDate" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quiz_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Quiz" ("academicYear", "createdAt", "createdBy", "description", "dueDate", "grade", "id", "isActive", "schoolId", "section", "subject", "title") SELECT "academicYear", "createdAt", "createdBy", "description", "dueDate", "grade", "id", "isActive", "schoolId", "section", "subject", "title" FROM "Quiz";
DROP TABLE "Quiz";
ALTER TABLE "new_Quiz" RENAME TO "Quiz";
CREATE INDEX "Quiz_schoolId_grade_academicYear_idx" ON "Quiz"("schoolId", "grade", "academicYear");
CREATE INDEX "Quiz_tenantId_grade_academicYear_idx" ON "Quiz"("tenantId", "grade", "academicYear");
CREATE INDEX "Quiz_districtId_grade_academicYear_idx" ON "Quiz"("districtId", "grade", "academicYear");
CREATE INDEX "Quiz_blockId_grade_academicYear_idx" ON "Quiz"("blockId", "grade", "academicYear");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
