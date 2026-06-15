import { RecordStatus } from "@prisma/client"

import { prisma } from "../src/lib/prisma"

const PLATFORM_OWNER_EMAIL = "durgaprasadt235@gmail.com"
const PLATFORM_ORGANIZATION_NAME = "TalentNest Technologies"
const CONFIRMATION_VARIABLE = "CONFIRM_RESET_CLIENT_DATA"
const CONFIRMATION_VALUE = "YES"

type CountResult = {
  label: string
  count: number
}

async function main() {
  const owners = await prisma.user.findMany({
    where: {
      email: {
        equals: PLATFORM_OWNER_EMAIL,
        mode: "insensitive",
      },
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (owners.length !== 1) {
    throw new Error(
      `Reset aborted: expected exactly one user with email ${PLATFORM_OWNER_EMAIL}, found ${owners.length}.`,
    )
  }

  const owner = owners[0]
  const preservedOrganizationId =
    owner.organization?.name === PLATFORM_ORGANIZATION_NAME
      ? owner.organization.id
      : undefined

  const counts = await getDeletionPreview(owner.id, preservedOrganizationId)
  const organizations = await prisma.organization.findMany({
    where: preservedOrganizationId
      ? { id: { not: preservedOrganizationId } }
      : undefined,
    select: { name: true, slug: true },
    orderBy: { name: "asc" },
  })
  const users = await prisma.user.findMany({
    where: { id: { not: owner.id } },
    select: { email: true, role: true },
    orderBy: { email: "asc" },
  })

  printPreview(counts, organizations, users, preservedOrganizationId)

  if (process.env[CONFIRMATION_VARIABLE] !== CONFIRMATION_VALUE) {
    throw new Error(
      `Reset not performed. Set ${CONFIRMATION_VARIABLE}=${CONFIRMATION_VALUE} to confirm this destructive operation.`,
    )
  }

  await prisma.$transaction(
    async (tx) => {
      const transactionOwner = await tx.user.findUnique({
        where: { id: owner.id },
        select: { email: true },
      })
      if (
        transactionOwner?.email.toLowerCase() !== PLATFORM_OWNER_EMAIL.toLowerCase()
      ) {
        throw new Error(
          `Reset aborted: preserved user no longer matches ${PLATFORM_OWNER_EMAIL}.`,
        )
      }

      // Delete operational children explicitly so restrictive foreign keys cannot
      // prevent the organization and user cleanup.
      await tx.attendanceCorrectionRequest.deleteMany()
      await tx.attendanceFreeze.deleteMany()
      await tx.attendanceAlert.deleteMany()
      await tx.attendanceException.deleteMany()
      await tx.weeklyAttendanceInvoice.deleteMany()
      await tx.weeklyAttendanceLine.deleteMany()
      await tx.weeklyAttendanceBatch.deleteMany()
      await tx.attendanceRecord.deleteMany()
      await tx.shift.deleteMany()
      await tx.propertyGeofence.deleteMany()
      await tx.userPropertyAccess.deleteMany()
      await tx.auditLog.deleteMany()
      await tx.attendanceDevice.deleteMany()
      await tx.employee.deleteMany()
      await tx.staffingCompany.deleteMany()
      await tx.department.deleteMany()
      await tx.property.deleteMany()
      await tx.legalEntity.deleteMany()
      await tx.organizationInvitation.deleteMany()
      await tx.organizationFeatureOverride.deleteMany()
      await tx.organizationSubscription.deleteMany()

      await tx.user.deleteMany({
        where: {
          id: { not: owner.id },
          NOT: {
            email: {
              equals: PLATFORM_OWNER_EMAIL,
              mode: "insensitive",
            },
          },
        },
      })

      await tx.user.update({
        where: { id: owner.id },
        data: {
          role: "PLATFORM_OWNER",
          status: RecordStatus.ACTIVE,
          mustChangePassword: false,
          temporaryPassword: null,
          staffingCompanyId: null,
          departmentId: null,
          organizationId: preservedOrganizationId ?? null,
        },
      })

      await tx.organization.deleteMany({
        where: preservedOrganizationId
          ? { id: { not: preservedOrganizationId } }
          : undefined,
      })
    },
    {
      maxWait: 10_000,
      timeout: 120_000,
    },
  )

  const preservedOwner = await prisma.user.findUnique({
    where: { id: owner.id },
    select: {
      email: true,
      role: true,
      status: true,
      mustChangePassword: true,
      clerkUserId: true,
      organization: {
        select: { name: true },
      },
    },
  })

  console.log("\nClient data reset completed.")
  console.table([preservedOwner])
}

async function getDeletionPreview(
  ownerId: string,
  preservedOrganizationId?: string,
): Promise<CountResult[]> {
  const organizationWhere = preservedOrganizationId
    ? { id: { not: preservedOrganizationId } }
    : undefined

  const counts = await Promise.all([
    prisma.user.count({ where: { id: { not: ownerId } } }),
    prisma.organization.count({ where: organizationWhere }),
    prisma.legalEntity.count(),
    prisma.property.count(),
    prisma.department.count(),
    prisma.employee.count(),
    prisma.attendanceDevice.count(),
    prisma.propertyGeofence.count(),
    prisma.shift.count(),
    prisma.attendanceRecord.count(),
    prisma.attendanceException.count(),
    prisma.attendanceFreeze.count(),
    prisma.attendanceAlert.count(),
    prisma.attendanceCorrectionRequest.count(),
    prisma.weeklyAttendanceBatch.count(),
    prisma.weeklyAttendanceLine.count(),
    prisma.weeklyAttendanceInvoice.count(),
    prisma.organizationSubscription.count(),
    prisma.organizationFeatureOverride.count(),
    prisma.organizationInvitation.count(),
    prisma.staffingCompany.count(),
    prisma.userPropertyAccess.count(),
    prisma.auditLog.count(),
  ])

  const labels = [
    "Non-platform users",
    "Client organizations",
    "Legal entities",
    "Properties",
    "Departments",
    "Employees",
    "Attendance devices",
    "Property geofences",
    "Schedules / shifts",
    "Attendance records",
    "Attendance exceptions",
    "Attendance freezes",
    "Attendance alerts",
    "Attendance correction requests",
    "Weekly attendance batches",
    "Weekly attendance lines",
    "Weekly attendance invoices",
    "Organization subscriptions",
    "Organization feature overrides",
    "Organization invitations",
    "Staffing companies",
    "User property access records",
    "Audit logs",
  ]

  return labels.map((label, index) => ({ label, count: counts[index] }))
}

function printPreview(
  counts: CountResult[],
  organizations: Array<{ name: string; slug: string }>,
  users: Array<{ email: string; role: string }>,
  preservedOrganizationId?: string,
) {
  console.log("CLIENT DATA RESET PREVIEW")
  console.log(`Preserved user: ${PLATFORM_OWNER_EMAIL}`)
  console.log("Preserved Clerk link: unchanged")
  console.log("Preserved system settings: yes")
  console.log(
    `Preserved organization: ${
      preservedOrganizationId ? PLATFORM_ORGANIZATION_NAME : "none"
    }`,
  )

  console.log("\nRecords to delete:")
  console.table(counts)

  console.log("\nOrganizations to delete:")
  console.table(organizations)

  console.log("\nUsers to delete:")
  console.table(users)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error)
    await prisma.$disconnect()
    process.exit(1)
  })
