ALTER TYPE "OrganizationInvitationStatus" ADD VALUE 'SENT' AFTER 'PENDING';

ALTER TABLE "OrganizationInvitation"
ADD COLUMN "sentAt" TIMESTAMP(3),
ADD COLUMN "lastError" TEXT;
