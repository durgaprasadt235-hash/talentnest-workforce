INSERT INTO "OrganizationSubscription" (
  "id",
  "organizationId",
  "planKey",
  "planName",
  "billingCycle",
  "status",
  "startedAt",
  "updatedAt"
)
SELECT
  'legacy-sub-' || MD5(o."id"),
  o."id",
  'legacy',
  'Legacy Pilot',
  'MANUAL',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "OrganizationSubscription" s WHERE s."organizationId" = o."id"
);

INSERT INTO "OrganizationFeatureOverride" (
  "id",
  "organizationId",
  "canUseScheduling",
  "canUseAttendance",
  "canUseTimesheets",
  "canUseInvoices",
  "canUsePayments",
  "canUseReports",
  "canUseKiosk",
  "canUseStaffing",
  "reason",
  "updatedAt"
)
SELECT
  'legacy-features-' || MD5(o."id"),
  o."id",
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  'Preserved operational access for an organization created before feature enforcement.',
  CURRENT_TIMESTAMP
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "OrganizationFeatureOverride" f WHERE f."organizationId" = o."id"
);
