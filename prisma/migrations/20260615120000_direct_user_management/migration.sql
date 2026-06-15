ALTER TABLE "User"
ADD COLUMN "departmentId" TEXT,
ADD COLUMN "temporaryPassword" TEXT,
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL DEFAULT 'system',
    "enableInvitations" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "SystemSetting" ("id", "enableInvitations", "updatedAt")
VALUES ('system', false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
