ALTER TYPE "WeeklyAttendanceInvoiceStatus" RENAME VALUE 'ISSUED' TO 'SENT';

ALTER TABLE "WeeklyAttendanceInvoice"
ADD COLUMN "invoiceNumber" TEXT,
ADD COLUMN "billingWeekStart" DATE,
ADD COLUMN "billingWeekEnd" DATE,
ADD COLUMN "directHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
ADD COLUMN "staffingHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
ADD COLUMN "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "sentAt" TIMESTAMP(3);

UPDATE "WeeklyAttendanceInvoice" invoice
SET
  "invoiceNumber" = 'TN-' || UPPER(SUBSTRING(invoice."id" FROM 1 FOR 10)),
  "billingWeekStart" = batch."weekStartDate",
  "billingWeekEnd" = batch."weekEndDate",
  "directHours" = CASE WHEN invoice."type" = 'PAYROLL' THEN invoice."totalHours" ELSE 0 END,
  "staffingHours" = CASE WHEN invoice."type" = 'STAFFING' THEN invoice."totalHours" ELSE 0 END,
  "sentAt" = invoice."issuedAt"
FROM "WeeklyAttendanceBatch" batch
WHERE invoice."batchId" = batch."id";

ALTER TABLE "WeeklyAttendanceInvoice"
ALTER COLUMN "invoiceNumber" SET NOT NULL,
ALTER COLUMN "billingWeekStart" SET NOT NULL,
ALTER COLUMN "billingWeekEnd" SET NOT NULL;

CREATE UNIQUE INDEX "WeeklyAttendanceInvoice_invoiceNumber_key" ON "WeeklyAttendanceInvoice"("invoiceNumber");
