-- CreateEnum
CREATE TYPE "WeeklyAttendanceBatchStatus" AS ENUM ('DRAFT', 'PENDING_MANAGER_REVIEW', 'APPROVED', 'CORRECTIONS_REQUIRED', 'LOCKED');

-- CreateEnum
CREATE TYPE "WeeklyAttendanceLineApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'CORRECTION_REQUIRED', 'REJECTED');

-- CreateTable
CREATE TABLE "WeeklyAttendanceBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "weekEndDate" DATE NOT NULL,
    "status" "WeeklyAttendanceBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyAttendanceBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyAttendanceLine" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "departmentId" TEXT,
    "employeeId" TEXT NOT NULL,
    "staffingCompanyId" TEXT,
    "regularHours" DECIMAL(8,2) NOT NULL,
    "overtimeHours" DECIMAL(8,2) NOT NULL,
    "totalHours" DECIMAL(8,2) NOT NULL,
    "missingPunchCount" INTEGER NOT NULL DEFAULT 0,
    "exceptionCount" INTEGER NOT NULL DEFAULT 0,
    "correctionPendingCount" INTEGER NOT NULL DEFAULT 0,
    "approvalStatus" "WeeklyAttendanceLineApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "managerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyAttendanceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyAttendanceBatch_organizationId_idx" ON "WeeklyAttendanceBatch"("organizationId");

-- CreateIndex
CREATE INDEX "WeeklyAttendanceBatch_propertyId_status_idx" ON "WeeklyAttendanceBatch"("propertyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyAttendanceBatch_propertyId_weekStartDate_key" ON "WeeklyAttendanceBatch"("propertyId", "weekStartDate");

-- CreateIndex
CREATE INDEX "WeeklyAttendanceLine_organizationId_idx" ON "WeeklyAttendanceLine"("organizationId");

-- CreateIndex
CREATE INDEX "WeeklyAttendanceLine_propertyId_idx" ON "WeeklyAttendanceLine"("propertyId");

-- CreateIndex
CREATE INDEX "WeeklyAttendanceLine_staffingCompanyId_idx" ON "WeeklyAttendanceLine"("staffingCompanyId");

-- CreateIndex
CREATE INDEX "WeeklyAttendanceLine_approvalStatus_idx" ON "WeeklyAttendanceLine"("approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyAttendanceLine_batchId_employeeId_key" ON "WeeklyAttendanceLine"("batchId", "employeeId");

-- AddForeignKey
ALTER TABLE "WeeklyAttendanceBatch" ADD CONSTRAINT "WeeklyAttendanceBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAttendanceBatch" ADD CONSTRAINT "WeeklyAttendanceBatch_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAttendanceBatch" ADD CONSTRAINT "WeeklyAttendanceBatch_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAttendanceLine" ADD CONSTRAINT "WeeklyAttendanceLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "WeeklyAttendanceBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAttendanceLine" ADD CONSTRAINT "WeeklyAttendanceLine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAttendanceLine" ADD CONSTRAINT "WeeklyAttendanceLine_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAttendanceLine" ADD CONSTRAINT "WeeklyAttendanceLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAttendanceLine" ADD CONSTRAINT "WeeklyAttendanceLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyAttendanceLine" ADD CONSTRAINT "WeeklyAttendanceLine_staffingCompanyId_fkey" FOREIGN KEY ("staffingCompanyId") REFERENCES "StaffingCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

