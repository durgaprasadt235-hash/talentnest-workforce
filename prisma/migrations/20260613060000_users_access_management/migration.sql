ALTER TABLE "User" ADD COLUMN "staffingCompanyId" TEXT;

CREATE TABLE "UserPropertyAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPropertyAccess_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "User_staffingCompanyId_idx" ON "User"("staffingCompanyId");
CREATE INDEX "UserPropertyAccess_propertyId_idx" ON "UserPropertyAccess"("propertyId");
CREATE UNIQUE INDEX "UserPropertyAccess_userId_propertyId_key" ON "UserPropertyAccess"("userId", "propertyId");

ALTER TABLE "User" ADD CONSTRAINT "User_staffingCompanyId_fkey"
FOREIGN KEY ("staffingCompanyId") REFERENCES "StaffingCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserPropertyAccess" ADD CONSTRAINT "UserPropertyAccess_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserPropertyAccess" ADD CONSTRAINT "UserPropertyAccess_propertyId_fkey"
FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "User"
SET "role" = CASE "role"
  WHEN 'PLATFORM_SUPER_ADMIN' THEN 'PLATFORM_ADMIN'
  WHEN 'STAFFING_COMPANY_ADMIN' THEN 'STAFFING_ADMIN'
  WHEN 'STAFFING_COMPANY_COORDINATOR' THEN 'STAFFING_BILLING'
  WHEN 'REGIONAL_MANAGER' THEN 'PROPERTY_MANAGER'
  WHEN 'DEPARTMENT_SUPERVISOR' THEN 'EMPLOYEE'
  WHEN 'READ_ONLY_AUDITOR' THEN 'EMPLOYEE'
  ELSE "role"
END;

UPDATE "User"
SET
  "firstName" = 'Durga Prasad',
  "lastName" = 'Thoorpati',
  "role" = 'PLATFORM_OWNER',
  "organizationId" = NULL,
  "staffingCompanyId" = NULL
WHERE LOWER("email") = 'durgaprasadt235@gmail.com';
