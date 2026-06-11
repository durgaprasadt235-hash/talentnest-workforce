ALTER TYPE "WeeklyAttendanceBatchStatus" ADD VALUE 'SENT_TO_CORPORATE';
ALTER TYPE "WeeklyAttendanceBatchStatus" ADD VALUE 'SENT_TO_FINANCE';
ALTER TYPE "WeeklyAttendanceBatchStatus" ADD VALUE 'INVOICED';
ALTER TYPE "WeeklyAttendanceBatchStatus" ADD VALUE 'PAID';

ALTER TABLE "WeeklyAttendanceBatch"
ADD COLUMN "managerReminderAt" TIMESTAMP(3),
ADD COLUMN "financeReviewedAt" TIMESTAMP(3);
