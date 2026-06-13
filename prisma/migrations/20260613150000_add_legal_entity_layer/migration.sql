CREATE TABLE "LegalEntity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "ein" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalEntity_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Property" ADD COLUMN "legalEntityId" TEXT;

CREATE INDEX "LegalEntity_organizationId_idx" ON "LegalEntity"("organizationId");
CREATE INDEX "LegalEntity_status_idx" ON "LegalEntity"("status");
CREATE UNIQUE INDEX "LegalEntity_organizationId_legalName_key" ON "LegalEntity"("organizationId", "legalName");
CREATE INDEX "Property_legalEntityId_idx" ON "Property"("legalEntityId");

ALTER TABLE "LegalEntity" ADD CONSTRAINT "LegalEntity_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Property" ADD CONSTRAINT "Property_legalEntityId_fkey"
FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "LegalEntity" ("id", "organizationId", "legalName", "displayName", "updatedAt")
SELECT DISTINCT 'legal-chase-' || MD5(p."organizationId"), p."organizationId", 'Chase Hospitality LLP', 'Chase Hospitality LLP', CURRENT_TIMESTAMP
FROM "Property" p
WHERE p."name" ILIKE '%La Quinta%'
ON CONFLICT ("organizationId", "legalName") DO NOTHING;

INSERT INTO "LegalEntity" ("id", "organizationId", "legalName", "displayName", "updatedAt")
SELECT DISTINCT 'legal-windsor-' || MD5(p."organizationId"), p."organizationId", 'Windsor Hospitality LLC', 'Windsor Hospitality LLC', CURRENT_TIMESTAMP
FROM "Property" p
WHERE p."name" ILIKE '%Best Western%Erie%'
ON CONFLICT ("organizationId", "legalName") DO NOTHING;

INSERT INTO "LegalEntity" ("id", "organizationId", "legalName", "displayName", "updatedAt")
SELECT DISTINCT 'legal-newport-' || MD5(p."organizationId"), p."organizationId", 'Newport Hospitality LLC', 'Newport Hospitality LLC', CURRENT_TIMESTAMP
FROM "Property" p
WHERE p."name" ILIKE '%Home2%'
ON CONFLICT ("organizationId", "legalName") DO NOTHING;

INSERT INTO "LegalEntity" ("id", "organizationId", "legalName", "displayName", "updatedAt")
SELECT DISTINCT 'legal-dorset-' || MD5(p."organizationId"), p."organizationId", 'Dorset Hospitality LLC', 'Dorset Hospitality LLC', CURRENT_TIMESTAMP
FROM "Property" p
WHERE p."name" ILIKE '%Spark%'
ON CONFLICT ("organizationId", "legalName") DO NOTHING;

INSERT INTO "LegalEntity" ("id", "organizationId", "legalName", "displayName", "updatedAt")
SELECT DISTINCT 'legal-ashford-' || MD5(p."organizationId"), p."organizationId", 'Ashford Hospitality LLC', 'Ashford Hospitality LLC', CURRENT_TIMESTAMP
FROM "Property" p
WHERE p."name" ILIKE '%Candlewood%'
ON CONFLICT ("organizationId", "legalName") DO NOTHING;

UPDATE "Property" p SET "legalEntityId" = le."id"
FROM "LegalEntity" le
WHERE p."organizationId" = le."organizationId"
AND (
  (p."name" ILIKE '%La Quinta%' AND le."legalName" = 'Chase Hospitality LLP') OR
  (p."name" ILIKE '%Best Western%Erie%' AND le."legalName" = 'Windsor Hospitality LLC') OR
  (p."name" ILIKE '%Home2%' AND le."legalName" = 'Newport Hospitality LLC') OR
  (p."name" ILIKE '%Spark%' AND le."legalName" = 'Dorset Hospitality LLC') OR
  (p."name" ILIKE '%Candlewood%' AND le."legalName" = 'Ashford Hospitality LLC')
);
