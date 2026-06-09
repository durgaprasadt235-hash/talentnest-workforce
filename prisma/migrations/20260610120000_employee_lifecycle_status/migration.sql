CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED', 'ON_LEAVE', 'SUSPENDED');

ALTER TABLE "Employee" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Employee"
ALTER COLUMN "status" TYPE "EmployeeStatus"
USING ("status"::text::"EmployeeStatus");
ALTER TABLE "Employee" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

ALTER TABLE "Employee"
ADD COLUMN "terminatedAt" TIMESTAMP(3),
ADD COLUMN "terminationReason" TEXT;

CREATE INDEX "Employee_status_idx" ON "Employee"("status");
