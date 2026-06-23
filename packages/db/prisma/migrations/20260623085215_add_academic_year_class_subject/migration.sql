-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'General',
    "publishDate" TEXT NOT NULL,
    "expiryDate" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Notice_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AcademicYear_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "section" TEXT NOT NULL,
    "classTeacherId" TEXT,
    "capacity" INTEGER,
    "stream" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassSection_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "grade" INTEGER,
    "stream" TEXT,
    "maxMarks" REAL NOT NULL DEFAULT 100,
    "isElective" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubjectAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "classSectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubjectAssignment_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "ClassSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubjectAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Notice_schoolId_publishDate_idx" ON "Notice"("schoolId", "publishDate");

-- CreateIndex
CREATE INDEX "AcademicYear_schoolId_isCurrent_idx" ON "AcademicYear"("schoolId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_schoolId_label_key" ON "AcademicYear"("schoolId", "label");

-- CreateIndex
CREATE INDEX "ClassSection_schoolId_academicYear_idx" ON "ClassSection"("schoolId", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSection_schoolId_academicYear_grade_section_key" ON "ClassSection"("schoolId", "academicYear", "grade", "section");

-- CreateIndex
CREATE INDEX "Subject_schoolId_isActive_idx" ON "Subject"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_schoolId_name_grade_key" ON "Subject"("schoolId", "name", "grade");

-- CreateIndex
CREATE INDEX "SubjectAssignment_classSectionId_idx" ON "SubjectAssignment"("classSectionId");

-- CreateIndex
CREATE INDEX "SubjectAssignment_staffId_idx" ON "SubjectAssignment"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectAssignment_staffId_classSectionId_subjectId_academicYear_key" ON "SubjectAssignment"("staffId", "classSectionId", "subjectId", "academicYear");
