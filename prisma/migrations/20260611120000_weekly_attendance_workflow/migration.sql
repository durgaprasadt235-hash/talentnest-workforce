CREATE TYPE "WeeklyAttendanceInvoiceType" AS ENUM ('PAYROLL', 'STAFFING');
CREATE TYPE "WeeklyAttendanceInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID');

ALTER TABLE "WeeklyAttendanceBatch"
ADD COLUMN "sentToCorporateAt" TIMESTAMP(3),
ADD COLUMN "sentToFinanceAt" TIMESTAMP(3);

CREATE TABLE "WeeklyAttendanceInvoice" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "staffingCompanyId" TEXT,
    "type" "WeeklyAttendanceInvoiceType" NOT NULL,
    "status" "WeeklyAttendanceInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "regularHours" DECIMAL(8,2) NOT NULL,
    "overtimeHours" DECIMAL(8,2) NOT NULL,
    "totalHours" DECIMAL(8,2) NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyAttendanceInvoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WeeklyAttendanceInvoice_batchId_idx" ON "WeeklyAttendanceInvoice"("batchId");
CREATE INDEX "WeeklyAttendanceInvoice_organizationId_status_idx" ON "WeeklyAttendanceInvoice"("organizationId", "status");
CREATE INDEX "WeeklyAttendanceInvoice_propertyId_idx" ON "WeeklyAttendanceInvoice"("propertyId");
CREATE INDEX "WeeklyAttendanceInvoice_staffingCompanyId_status_idx" ON "WeeklyAttendanceInvoice"("staffingCompanyId", "status");

ALTER TABLE "WeeklyAttendanceInvoice" ADD CONSTRAINT "WeeklyAttendanceInvoice_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "WeeklyAttendanceBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyAttendanceInvoice" ADD CONSTRAINT "WeeklyAttendanceInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyAttendanceInvoice" ADD CONSTRAINT "WeeklyAttendanceInvoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyAttendanceInvoice" ADD CONSTRAINT "WeeklyAttendanceInvoice_staffingCompanyId_fkey" FOREIGN KEY ("staffingCompanyId") REFERENCES "StaffingCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
