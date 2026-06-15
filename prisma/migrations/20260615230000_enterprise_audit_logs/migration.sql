CREATE TYPE "AuditType" AS ENUM ('PLATFORM', 'ORGANIZATION');

ALTER TABLE "AuditLog"
ADD COLUMN "auditType" "AuditType" NOT NULL DEFAULT 'ORGANIZATION',
ADD COLUMN "departmentId" TEXT,
ADD COLUMN "employeeId" TEXT;

UPDATE "AuditLog"
SET "auditType" = 'PLATFORM'
WHERE "entityType" IN ('Organization', 'OrganizationSubscription', 'OrganizationFeatureOverride', 'PlatformConfiguration', 'StripeEvent')
   OR ("entityType" = 'User' AND "organizationId" IS NULL);

UPDATE "AuditLog"
SET "employeeId" = "entityId"
WHERE "entityType" = 'Employee' AND "entityId" IS NOT NULL;

UPDATE "AuditLog"
SET "departmentId" = "entityId"
WHERE "entityType" = 'Department' AND "entityId" IS NOT NULL;

CREATE INDEX "AuditLog_departmentId_idx" ON "AuditLog"("departmentId");
CREATE INDEX "AuditLog_employeeId_idx" ON "AuditLog"("employeeId");
CREATE INDEX "AuditLog_auditType_createdAt_idx" ON "AuditLog"("auditType", "createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
