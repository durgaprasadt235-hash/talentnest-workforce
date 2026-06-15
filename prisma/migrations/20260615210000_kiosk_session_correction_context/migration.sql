ALTER TABLE "AttendanceCorrectionRequest"
ADD COLUMN "requestedBySource" TEXT NOT NULL DEFAULT 'KIOSK',
ADD COLUMN "requestedDate" DATE,
ADD COLUMN "requestedTime" TEXT,
ADD COLUMN "notes" TEXT;
