const Database = require('better-sqlite3');
const db = new Database('packages/db/prisma/dev.db');

const stmts = [
  `CREATE TABLE IF NOT EXISTS "Homework" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "gradeTo" INTEGER,
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "academicYear" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Homework_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS "Homework_schoolId_grade_academicYear_idx" ON "Homework"("schoolId", "grade", "academicYear")`,

  `CREATE TABLE IF NOT EXISTS "HomeworkSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "note" TEXT,
    "fileUrl" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedDone" BOOLEAN NOT NULL DEFAULT 0,
    CONSTRAINT "HomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "HomeworkSubmission_homeworkId_studentId_key" ON "HomeworkSubmission"("homeworkId", "studentId")`,
  `CREATE INDEX IF NOT EXISTS "HomeworkSubmission_homeworkId_idx" ON "HomeworkSubmission"("homeworkId")`,
  `CREATE INDEX IF NOT EXISTS "HomeworkSubmission_studentId_idx" ON "HomeworkSubmission"("studentId")`,

  `CREATE TABLE IF NOT EXISTS "SyllabusChapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "chapterNo" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "totalTopics" INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusChapter_schoolId_subject_grade_academicYear_chapterNo_key" ON "SyllabusChapter"("schoolId", "subject", "grade", "academicYear", "chapterNo")`,
  `CREATE INDEX IF NOT EXISTS "SyllabusChapter_schoolId_grade_subject_idx" ON "SyllabusChapter"("schoolId", "grade", "subject")`,

  `CREATE TABLE IF NOT EXISTS "ChapterProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chapterId" TEXT NOT NULL UNIQUE,
    "completedTopics" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT,
    CONSTRAINT "ChapterProgress_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "SyllabusChapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS "Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "isbn" TEXT,
    "publisher" TEXT,
    "edition" TEXT,
    "subject" TEXT,
    "grade" INTEGER,
    "totalCopies" INTEGER NOT NULL DEFAULT 1,
    "availableCopies" INTEGER NOT NULL DEFAULT 1,
    "coverUrl" TEXT,
    "addedBy" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Book_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS "Book_schoolId_idx" ON "Book"("schoolId")`,

  `CREATE TABLE IF NOT EXISTS "BookReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "studentId" TEXT,
    "studentName" TEXT NOT NULL,
    "issueDate" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "returnDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "issuedBy" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    CONSTRAINT "BookReservation_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS "BookReservation_schoolId_status_idx" ON "BookReservation"("schoolId", "status")`,
  `CREATE INDEX IF NOT EXISTS "BookReservation_bookId_idx" ON "BookReservation"("bookId")`,

  `CREATE TABLE IF NOT EXISTS "LostBookRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "studentId" TEXT,
    "studentName" TEXT NOT NULL,
    "reportedDate" TEXT NOT NULL,
    "fineAmount" REAL NOT NULL DEFAULT 0,
    "fineStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "schoolId" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    CONSTRAINT "LostBookRecord_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS "LostBookRecord_schoolId_idx" ON "LostBookRecord"("schoolId")`,

  `CREATE TABLE IF NOT EXISTS "DigitalResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT,
    "tenantId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "grade" INTEGER,
    "gradeTo" INTEGER,
    "fileUrl" TEXT,
    "externalUrl" TEXT,
    "description" TEXT,
    "addedBy" TEXT NOT NULL,
    "addedByName" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE INDEX IF NOT EXISTS "DigitalResource_schoolId_idx" ON "DigitalResource"("schoolId")`,
  `CREATE INDEX IF NOT EXISTS "DigitalResource_tenantId_idx" ON "DigitalResource"("tenantId")`,
];

let ok = 0, err = 0;
for (const s of stmts) {
  try {
    db.exec(s);
    console.log('OK:', s.slice(0, 70).replace(/\n/g, ' '));
    ok++;
  } catch (e) {
    console.error('ERR:', e.message, '|', s.slice(0, 60));
    err++;
  }
}
db.close();
console.log(`\nDone: ${ok} ok, ${err} errors`);
