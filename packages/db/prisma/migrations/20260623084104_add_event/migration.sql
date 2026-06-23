-- AlterTable
ALTER TABLE "Student" ADD COLUMN "aadhaarNo" TEXT;
ALTER TABLE "Student" ADD COLUMN "admissionClass" INTEGER;
ALTER TABLE "Student" ADD COLUMN "admissionDate" DATETIME;
ALTER TABLE "Student" ADD COLUMN "admissionType" TEXT;
ALTER TABLE "Student" ADD COLUMN "blockAddr" TEXT;
ALTER TABLE "Student" ADD COLUMN "bloodGroup" TEXT;
ALTER TABLE "Student" ADD COLUMN "cgpa" REAL;
ALTER TABLE "Student" ADD COLUMN "correspondenceAddress" TEXT;
ALTER TABLE "Student" ADD COLUMN "cwsnStatus" BOOLEAN;
ALTER TABLE "Student" ADD COLUMN "districtAddr" TEXT;
ALTER TABLE "Student" ADD COLUMN "docAadhaar" TEXT;
ALTER TABLE "Student" ADD COLUMN "docBirthCert" TEXT;
ALTER TABLE "Student" ADD COLUMN "docCaste" TEXT;
ALTER TABLE "Student" ADD COLUMN "docIncome" TEXT;
ALTER TABLE "Student" ADD COLUMN "docMedical" TEXT;
ALTER TABLE "Student" ADD COLUMN "docOther" TEXT;
ALTER TABLE "Student" ADD COLUMN "docPhoto" TEXT;
ALTER TABLE "Student" ADD COLUMN "docResidence" TEXT;
ALTER TABLE "Student" ADD COLUMN "docTc" TEXT;
ALTER TABLE "Student" ADD COLUMN "fatherEducation" TEXT;
ALTER TABLE "Student" ADD COLUMN "fatherName" TEXT;
ALTER TABLE "Student" ADD COLUMN "fatherOccupation" TEXT;
ALTER TABLE "Student" ADD COLUMN "fatherPhone" TEXT;
ALTER TABLE "Student" ADD COLUMN "firstName" TEXT;
ALTER TABLE "Student" ADD COLUMN "healthCheckupDate" DATETIME;
ALTER TABLE "Student" ADD COLUMN "height" REAL;
ALTER TABLE "Student" ADD COLUMN "hostelFeeStatus" TEXT;
ALTER TABLE "Student" ADD COLUMN "hostelName" TEXT;
ALTER TABLE "Student" ADD COLUMN "hostelRequired" BOOLEAN;
ALTER TABLE "Student" ADD COLUMN "house" TEXT;
ALTER TABLE "Student" ADD COLUMN "lastName" TEXT;
ALTER TABLE "Student" ADD COLUMN "medium" TEXT;
ALTER TABLE "Student" ADD COLUMN "middleName" TEXT;
ALTER TABLE "Student" ADD COLUMN "motherEducation" TEXT;
ALTER TABLE "Student" ADD COLUMN "motherName" TEXT;
ALTER TABLE "Student" ADD COLUMN "motherOccupation" TEXT;
ALTER TABLE "Student" ADD COLUMN "motherPhone" TEXT;
ALTER TABLE "Student" ADD COLUMN "motherTongue" TEXT;
ALTER TABLE "Student" ADD COLUMN "nationality" TEXT;
ALTER TABLE "Student" ADD COLUMN "permanentAddress" TEXT;
ALTER TABLE "Student" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "Student" ADD COLUMN "pinCode" TEXT;
ALTER TABLE "Student" ADD COLUMN "previousClass" INTEGER;
ALTER TABLE "Student" ADD COLUMN "previousSchool" TEXT;
ALTER TABLE "Student" ADD COLUMN "profileUpdatedAt" DATETIME;
ALTER TABLE "Student" ADD COLUMN "profileUpdatedBy" TEXT;
ALTER TABLE "Student" ADD COLUMN "promotionStatus" TEXT;
ALTER TABLE "Student" ADD COLUMN "roomNumber" TEXT;
ALTER TABLE "Student" ADD COLUMN "stateAddr" TEXT;
ALTER TABLE "Student" ADD COLUMN "subjectsOpted" TEXT;
ALTER TABLE "Student" ADD COLUMN "tcNumber" TEXT;
ALTER TABLE "Student" ADD COLUMN "vaccinationStatus" TEXT;
ALTER TABLE "Student" ADD COLUMN "village" TEXT;
ALTER TABLE "Student" ADD COLUMN "weight" REAL;

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Other',
    "date" TEXT NOT NULL,
    "endDate" TEXT,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Event_scopeId_date_idx" ON "Event"("scopeId", "date");

-- CreateIndex
CREATE INDEX "Event_scope_scopeId_idx" ON "Event"("scope", "scopeId");
