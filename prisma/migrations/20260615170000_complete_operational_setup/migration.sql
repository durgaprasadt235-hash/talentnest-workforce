ALTER TYPE "EmploymentType" ADD VALUE IF NOT EXISTS 'STAFFING';

CREATE TYPE "DepartmentType" AS ENUM (
  'FRONT_DESK',
  'HOUSEKEEPING',
  'MAINTENANCE',
  'NIGHT_AUDIT',
  'MANAGEMENT',
  'FINANCE',
  'OTHER'
);

CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'APPROVED', 'LOCKED');

ALTER TABLE "Property"
ALTER COLUMN "code" DROP NOT NULL,
ADD COLUMN "brand" TEXT,
ADD COLUMN "addressLine2" TEXT;

ALTER TABLE "Department"
ALTER COLUMN "code" DROP NOT NULL,
ADD COLUMN "type" "DepartmentType" NOT NULL DEFAULT 'OTHER';

DROP INDEX IF EXISTS "Employee_employeeNumber_key";

ALTER TABLE "Employee"
ADD COLUMN "departmentRoleId" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "payRate" DECIMAL(10, 2),
ADD COLUMN "hireDate" DATE;

ALTER TABLE "StaffingCompany"
ADD COLUMN "contactName" TEXT,
ADD COLUMN "billingEmail" TEXT;

CREATE TABLE "DepartmentRole" (
  "id" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "isManager" BOOLEAN NOT NULL DEFAULT false,
  "canApproveAttendance" BOOLEAN NOT NULL DEFAULT false,
  "canManageSchedule" BOOLEAN NOT NULL DEFAULT false,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DepartmentRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Schedule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "weekStartDate" DATE NOT NULL,
  "notes" TEXT,
  "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Shift"
ADD COLUMN "scheduleId" TEXT,
ADD COLUMN "departmentRoleId" TEXT,
ADD COLUMN "breakMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "notes" TEXT;

CREATE UNIQUE INDEX "Employee_organizationId_employeeNumber_key" ON "Employee"("organizationId", "employeeNumber");
CREATE INDEX "Employee_departmentRoleId_idx" ON "Employee"("departmentRoleId");
CREATE UNIQUE INDEX "DepartmentRole_departmentId_code_key" ON "DepartmentRole"("departmentId", "code");
CREATE INDEX "DepartmentRole_departmentId_status_idx" ON "DepartmentRole"("departmentId", "status");
CREATE UNIQUE INDEX "Schedule_propertyId_weekStartDate_key" ON "Schedule"("propertyId", "weekStartDate");
CREATE INDEX "Schedule_organizationId_status_idx" ON "Schedule"("organizationId", "status");
CREATE INDEX "Shift_scheduleId_idx" ON "Shift"("scheduleId");

ALTER TABLE "DepartmentRole" ADD CONSTRAINT "DepartmentRole_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentRoleId_fkey" FOREIGN KEY ("departmentRoleId") REFERENCES "DepartmentRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_departmentRoleId_fkey" FOREIGN KEY ("departmentRoleId") REFERENCES "DepartmentRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
