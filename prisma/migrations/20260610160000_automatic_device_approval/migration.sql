-- AlterEnum
ALTER TYPE "AttendanceDeviceStatus" ADD VALUE 'REJECTED';

-- DropForeignKey
ALTER TABLE "AttendanceDevice" DROP CONSTRAINT "AttendanceDevice_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "AttendanceDevice" DROP CONSTRAINT "AttendanceDevice_propertyId_fkey";

-- DropIndex
DROP INDEX "AttendanceDevice_registrationToken_key";

-- AlterTable
ALTER TABLE "AttendanceDevice" DROP COLUMN "registrationToken",
ADD COLUMN     "fingerprintHash" TEXT,
ALTER COLUMN "organizationId" DROP NOT NULL,
ALTER COLUMN "propertyId" DROP NOT NULL,
ALTER COLUMN "deviceCode" DROP NOT NULL;

-- Preserve existing registered devices with a stable legacy fingerprint identity.
UPDATE "AttendanceDevice" SET "fingerprintHash" = 'legacy-' || "id" WHERE "fingerprintHash" IS NULL;
ALTER TABLE "AttendanceDevice" ALTER COLUMN "fingerprintHash" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDevice_fingerprintHash_key" ON "AttendanceDevice"("fingerprintHash");

-- AddForeignKey
ALTER TABLE "AttendanceDevice" ADD CONSTRAINT "AttendanceDevice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDevice" ADD CONSTRAINT "AttendanceDevice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
