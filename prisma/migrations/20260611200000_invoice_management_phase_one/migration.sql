ALTER TYPE "WeeklyAttendanceInvoiceType" RENAME VALUE 'PAYROLL' TO 'DIRECT';
ALTER TYPE "WeeklyAttendanceInvoiceType" ADD VALUE 'CONSOLIDATED';
ALTER TYPE "WeeklyAttendanceInvoiceStatus" ADD VALUE 'VOID';

ALTER TABLE "WeeklyAttendanceInvoice"
ADD COLUMN "rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "dueAt" TIMESTAMP(3);

UPDATE "WeeklyAttendanceInvoice"
SET "dueAt" = "sentAt" + INTERVAL '30 days'
WHERE "sentAt" IS NOT NULL AND "dueAt" IS NULL;
