-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT,
    "schoolId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approverRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Holiday_scopeId_startDate_idx" ON "Holiday"("scopeId", "startDate");

-- CreateIndex
CREATE INDEX "Holiday_scope_scopeId_idx" ON "Holiday"("scope", "scopeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_studentId_idx" ON "LeaveRequest"("studentId");

-- CreateIndex
CREATE INDEX "LeaveRequest_schoolId_status_idx" ON "LeaveRequest"("schoolId", "status");
