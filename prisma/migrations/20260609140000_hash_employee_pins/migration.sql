-- Rename the employee kiosk credential field and invalidate legacy plaintext PINs.
ALTER TABLE "Employee" RENAME COLUMN "clockPin" TO "clockPinHash";
UPDATE "Employee" SET "clockPinHash" = NULL WHERE "clockPinHash" IS NOT NULL;
