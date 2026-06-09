-- Constrain employee employment types to the supported master-data values.
CREATE TYPE "EmploymentType" AS ENUM ('DIRECT', 'AGENCY', 'TEMPORARY', 'SEASONAL');

ALTER TABLE "Employee"
ALTER COLUMN "employmentType" TYPE "EmploymentType"
USING (
  CASE UPPER("employmentType")
    WHEN 'AGENCY' THEN 'AGENCY'::"EmploymentType"
    WHEN 'TEMPORARY' THEN 'TEMPORARY'::"EmploymentType"
    WHEN 'SEASONAL' THEN 'SEASONAL'::"EmploymentType"
    ELSE 'DIRECT'::"EmploymentType"
  END
);
