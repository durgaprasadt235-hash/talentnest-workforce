INSERT INTO "User" (
  "id",
  "email",
  "firstName",
  "lastName",
  "role",
  "status",
  "createdAt",
  "updatedAt"
)
VALUES (
  'talentnest-platform-owner-durga',
  'durgaprasadt235@gmail.com',
  'Durga Prasad',
  'Thoorpati',
  'PLATFORM_OWNER',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO UPDATE
SET
  "firstName" = EXCLUDED."firstName",
  "lastName" = EXCLUDED."lastName",
  "role" = EXCLUDED."role",
  "organizationId" = NULL,
  "staffingCompanyId" = NULL,
  "status" = 'ACTIVE',
  "updatedAt" = CURRENT_TIMESTAMP;
