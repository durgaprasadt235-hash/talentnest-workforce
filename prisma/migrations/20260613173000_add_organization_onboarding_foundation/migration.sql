CREATE TYPE "OrganizationStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "SubscriptionBillingCycle" AS ENUM ('MONTHLY', 'ANNUAL', 'TRIAL', 'MANUAL');
CREATE TYPE "OrganizationSubscriptionStatus" AS ENUM ('PENDING', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "OrganizationInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

ALTER TABLE "Organization"
ADD COLUMN "billingAddress" TEXT,
ADD COLUMN "billingCity" TEXT,
ADD COLUMN "billingState" TEXT,
ADD COLUMN "billingZip" TEXT,
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "contactName" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "legalBusinessName" TEXT,
ADD COLUMN "organizationStatus" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE "OrganizationSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "billingCycle" "SubscriptionBillingCycle" NOT NULL,
    "status" "OrganizationSubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "trialEndsAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationFeatureOverride" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "canUseScheduling" BOOLEAN NOT NULL DEFAULT true,
    "canUseAttendance" BOOLEAN NOT NULL DEFAULT false,
    "canUseTimesheets" BOOLEAN NOT NULL DEFAULT true,
    "canUseInvoices" BOOLEAN NOT NULL DEFAULT true,
    "canUsePayments" BOOLEAN NOT NULL DEFAULT false,
    "canUseReports" BOOLEAN NOT NULL DEFAULT true,
    "canUseKiosk" BOOLEAN NOT NULL DEFAULT false,
    "canUseStaffing" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationFeatureOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" "OrganizationInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationSubscription_organizationId_key" ON "OrganizationSubscription"("organizationId");
CREATE INDEX "OrganizationSubscription_status_idx" ON "OrganizationSubscription"("status");
CREATE INDEX "OrganizationSubscription_stripeCustomerId_idx" ON "OrganizationSubscription"("stripeCustomerId");
CREATE INDEX "OrganizationSubscription_stripeSubscriptionId_idx" ON "OrganizationSubscription"("stripeSubscriptionId");
CREATE UNIQUE INDEX "OrganizationFeatureOverride_organizationId_key" ON "OrganizationFeatureOverride"("organizationId");
CREATE UNIQUE INDEX "OrganizationInvitation_token_key" ON "OrganizationInvitation"("token");
CREATE INDEX "OrganizationInvitation_organizationId_idx" ON "OrganizationInvitation"("organizationId");
CREATE INDEX "OrganizationInvitation_email_status_idx" ON "OrganizationInvitation"("email", "status");
CREATE INDEX "OrganizationInvitation_expiresAt_idx" ON "OrganizationInvitation"("expiresAt");

ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationFeatureOverride" ADD CONSTRAINT "OrganizationFeatureOverride_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
