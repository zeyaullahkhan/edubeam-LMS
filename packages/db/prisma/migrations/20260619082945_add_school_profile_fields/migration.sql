-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "District_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "districtId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Block_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "udiseCode" TEXT NOT NULL,
    "siteCode" TEXT,
    "type" TEXT,
    "hasVirtualClassroom" BOOLEAN NOT NULL DEFAULT false,
    "hasIctLab" BOOLEAN NOT NULL DEFAULT false,
    "address" TEXT,
    "principalName" TEXT,
    "phone" TEXT,
    "campusArea" REAL,
    "campusAreaUnit" TEXT,
    "builtUpArea" REAL,
    "numBuildings" INTEGER,
    "numClassrooms" INTEGER,
    "hasPlayground" BOOLEAN,
    "hasBoundaryWall" BOOLEAN,
    "hasLibrary" BOOLEAN,
    "hasLaboratory" BOOLEAN,
    "hasComputerLab" BOOLEAN,
    "hasSmartClassroom" BOOLEAN,
    "hasElectricity" BOOLEAN,
    "hasInternet" BOOLEAN,
    "hasCctv" BOOLEAN,
    "hasDrinkingWater" BOOLEAN,
    "drinkingWaterSource" TEXT,
    "numToilets" INTEGER,
    "numBoysToilets" INTEGER,
    "numGirlsToilets" INTEGER,
    "hasCwsnToilet" BOOLEAN,
    "hasHandwashing" BOOLEAN,
    "classesFrom" INTEGER,
    "classesTo" INTEGER,
    "streams" TEXT,
    "hasFireSafety" BOOLEAN,
    "hasDisasterPlan" BOOLEAN,
    "hasFirstAid" BOOLEAN,
    "hasSecurityGuard" BOOLEAN,
    "emergencyContact" TEXT,
    "profileUpdatedBy" TEXT,
    "profileUpdatedAt" DATETIME,
    CONSTRAINT "School_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "boys" INTEGER NOT NULL DEFAULT 0,
    "girls" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Enrollment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BoardResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "examType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "passPct" REAL NOT NULL,
    "academicYear" TEXT NOT NULL,
    CONSTRAINT "BoardResult_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "YearlyResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "examType" TEXT NOT NULL,
    "passPct" REAL NOT NULL,
    CONSTRAINT "YearlyResult_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IctDeployment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "teacherCount" INTEGER NOT NULL DEFAULT 0,
    "studentCount" INTEGER NOT NULL DEFAULT 0,
    "academicYear" TEXT NOT NULL,
    "lanIp" TEXT,
    "subnetMask" TEXT,
    "iduSerialNo" TEXT,
    "newIduSerialNo" TEXT,
    "iduModel" TEXT,
    "materialStatus" TEXT,
    "installRemark" TEXT,
    "engineerName" TEXT,
    "scheduledDate" TEXT,
    "certUpdate" TEXT,
    CONSTRAINT "IctDeployment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "admissionNo" TEXT,
    "rollNo" TEXT,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL DEFAULT 'M',
    "dateOfBirth" DATETIME,
    "grade" INTEGER NOT NULL,
    "section" TEXT,
    "guardianName" TEXT,
    "guardianPhone" TEXT,
    "guardianRelation" TEXT,
    "address" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GEN',
    "religion" TEXT,
    "isRte" BOOLEAN NOT NULL DEFAULT false,
    "bankAccount" TEXT,
    "healthNotes" TEXT,
    "isDropout" BOOLEAN NOT NULL DEFAULT false,
    "dropoutReason" TEXT,
    "academicYear" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
    "employeeId" TEXT,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL DEFAULT 'M',
    "dateOfBirth" DATETIME,
    "staffType" TEXT NOT NULL DEFAULT 'TEACHER',
    "designation" TEXT,
    "qualification" TEXT,
    "subjects" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "department" TEXT,
    "salaryGroup" TEXT,
    "joiningDate" DATETIME,
    "isClassTeacher" BOOLEAN NOT NULL DEFAULT false,
    "classTeacherOf" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "academicYear" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Staff_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "tenantId" TEXT,
    "districtId" TEXT,
    "blockId" TEXT,
    "schoolId" TEXT,
    "studentId" TEXT,
    "linkedStudentIds" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'P',
    "markedBy" TEXT,
    "academicYear" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'P',
    "markedBy" TEXT,
    "academicYear" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ExamResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "section" TEXT,
    "examType" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "marksObtained" REAL NOT NULL,
    "maxMarks" REAL NOT NULL DEFAULT 100,
    "grade_letter" TEXT,
    "remarks" TEXT
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schoolId" TEXT NOT NULL,
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
    CONSTRAINT "Quiz_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "correct" INTEGER NOT NULL,
    "marks" REAL NOT NULL DEFAULT 1,
    "orderNo" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "maxScore" REAL NOT NULL,
    "timeTaken" INTEGER,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lecture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "srNo" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "studioName" TEXT NOT NULL,
    "medium" TEXT NOT NULL DEFAULT 'Hindi',
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "standard" INTEGER NOT NULL,
    "teacherName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "youtubeUrl" TEXT
);

-- CreateTable
CREATE TABLE "ContentChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studioName" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "channelUrl" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_code_key" ON "Tenant"("code");

-- CreateIndex
CREATE UNIQUE INDEX "District_tenantId_name_key" ON "District"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Block_districtId_name_key" ON "Block"("districtId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "School_udiseCode_key" ON "School"("udiseCode");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_schoolId_academicYear_grade_key" ON "Enrollment"("schoolId", "academicYear", "grade");

-- CreateIndex
CREATE UNIQUE INDEX "BoardResult_schoolId_examType_subject_academicYear_key" ON "BoardResult"("schoolId", "examType", "subject", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "YearlyResult_schoolId_year_examType_key" ON "YearlyResult"("schoolId", "year", "examType");

-- CreateIndex
CREATE UNIQUE INDEX "IctDeployment_schoolId_key" ON "IctDeployment"("schoolId");

-- CreateIndex
CREATE INDEX "Student_schoolId_grade_idx" ON "Student"("schoolId", "grade");

-- CreateIndex
CREATE INDEX "Staff_schoolId_staffType_idx" ON "Staff"("schoolId", "staffType");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Attendance_schoolId_date_idx" ON "Attendance"("schoolId", "date");

-- CreateIndex
CREATE INDEX "Attendance_studentId_idx" ON "Attendance"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_studentId_date_key" ON "Attendance"("studentId", "date");

-- CreateIndex
CREATE INDEX "StaffAttendance_schoolId_date_idx" ON "StaffAttendance"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_staffId_date_key" ON "StaffAttendance"("staffId", "date");

-- CreateIndex
CREATE INDEX "ExamResult_schoolId_grade_academicYear_idx" ON "ExamResult"("schoolId", "grade", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "ExamResult_studentId_subject_examType_academicYear_key" ON "ExamResult"("studentId", "subject", "examType", "academicYear");

-- CreateIndex
CREATE INDEX "Quiz_schoolId_grade_academicYear_idx" ON "Quiz"("schoolId", "grade", "academicYear");

-- CreateIndex
CREATE INDEX "StudentAttempt_studentId_idx" ON "StudentAttempt"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAttempt_quizId_studentId_key" ON "StudentAttempt"("quizId", "studentId");

-- CreateIndex
CREATE INDEX "Lecture_standard_subject_idx" ON "Lecture"("standard", "subject");

-- CreateIndex
CREATE INDEX "Lecture_studioName_date_idx" ON "Lecture"("studioName", "date");

-- CreateIndex
CREATE INDEX "Lecture_standard_subject_studioName_idx" ON "Lecture"("standard", "subject", "studioName");

-- CreateIndex
CREATE UNIQUE INDEX "ContentChannel_studioName_key" ON "ContentChannel"("studioName");
