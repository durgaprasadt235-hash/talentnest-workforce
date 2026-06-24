import "dotenv/config"

import { clerkClient } from "@clerk/nextjs/server"
import { PrismaClient, RecordStatus, OrganizationInvitationStatus } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { hash } from "bcryptjs"

import { createAuditLog } from "@/src/lib/audit"
import { listRolePermissions } from "@/src/lib/rbac/permission-service"
import { Role, type Role as RoleType } from "@/src/lib/rbac/roles"

const TEST_PASSWORD = process.env.RBAC_TEST_PASSWORD ?? ""
const TEST_ORGANIZATION_SLUG = "rbac-validation-hotel-group"
const TEST_ORGANIZATION_NAME = "RBAC Validation Hotel Group"
const PRIMARY_PROPERTY_CODE = "RBAC-PROP-1"
const SECONDARY_PROPERTY_CODE = "RBAC-PROP-2"

type TestAccount = {
  email: string
  firstName: string
  lastName: string
  role: RoleType
  propertyScope: "none" | "primary" | "regional"
  department: boolean
}

const testAccounts: TestAccount[] = [
  {
    email: "testplatformops@talentnesttest.com",
    firstName: "Test",
    lastName: "Platform Operations",
    role: Role.PLATFORM_OPERATIONS,
    propertyScope: "none",
    department: false,
  },
  {
    email: "testhrops@talentnesttest.com",
    firstName: "Test",
    lastName: "HR Operations",
    role: Role.HR_OPERATIONS_ADMIN,
    propertyScope: "none",
    department: false,
  },
  {
    email: "testfinance@talentnesttest.com",
    firstName: "Test",
    lastName: "Finance",
    role: Role.FINANCE_ADMIN,
    propertyScope: "none",
    department: false,
  },
  {
    email: "testaudit@talentnesttest.com",
    firstName: "Test",
    lastName: "Audit",
    role: Role.AUDIT_ADMIN,
    propertyScope: "none",
    department: false,
  },
  {
    email: "testregional@talentnesttest.com",
    firstName: "Test",
    lastName: "Regional Manager",
    role: Role.REGIONAL_MANAGER,
    propertyScope: "regional",
    department: false,
  },
  {
    email: "testmanager@talentnesttest.com",
    firstName: "Test",
    lastName: "Property Manager",
    role: Role.PROPERTY_MANAGER,
    propertyScope: "primary",
    department: false,
  },
  {
    email: "testemployee@talentnesttest.com",
    firstName: "Test",
    lastName: "Employee",
    role: Role.EMPLOYEE,
    propertyScope: "primary",
    department: true,
  },
]

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

async function main() {
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY is required to provision Clerk test accounts.")
  }
  if (!TEST_PASSWORD) {
    throw new Error("RBAC_TEST_PASSWORD is required to provision RBAC test accounts.")
  }

  await listRolePermissions()
  const platformOwner = await prisma.user.findFirst({
    where: { role: Role.PLATFORM_OWNER, status: RecordStatus.ACTIVE },
    orderBy: { createdAt: "asc" },
  })
  if (!platformOwner) throw new Error("Active platform owner is required before creating RBAC test users.")

  const { organization, primaryProperty, secondaryProperty, department } = await ensureTestHierarchy()
  const propertyIds = [primaryProperty.id, secondaryProperty.id]
  const clerk = await clerkClient()
  const passwordHash = await hash(TEST_PASSWORD, 12)

  const results = []

  for (const account of testAccounts) {
    const organizationId = account.role === Role.PLATFORM_OPERATIONS ? null : organization.id
    const assignedPropertyIds =
      account.propertyScope === "regional"
        ? propertyIds
        : account.propertyScope === "primary"
          ? [primaryProperty.id]
          : []
    const departmentId = account.department ? department.id : null
    const clerkUserId = await ensureClerkUser(clerk, account)
    const invitation = await ensureAcceptedInvitation(account, organizationId, platformOwner.id)

    const user = await prisma.$transaction(async (tx) => {
      const upserted = await tx.user.upsert({
        where: { email: account.email },
        create: {
          clerkUserId,
          email: account.email,
          firstName: account.firstName,
          lastName: account.lastName,
          role: account.role,
          organizationId,
          departmentId,
          status: RecordStatus.ACTIVE,
          temporaryPassword: passwordHash,
          mustChangePassword: false,
        },
        update: {
          clerkUserId,
          firstName: account.firstName,
          lastName: account.lastName,
          role: account.role,
          organizationId,
          departmentId,
          status: RecordStatus.ACTIVE,
          temporaryPassword: passwordHash,
          mustChangePassword: false,
        },
      })

      await tx.userPropertyAccess.deleteMany({ where: { userId: upserted.id } })
      if (assignedPropertyIds.length) {
        await tx.userPropertyAccess.createMany({
          data: assignedPropertyIds.map((propertyId) => ({ userId: upserted.id, propertyId })),
          skipDuplicates: true,
        })
      }

      return upserted
    })

    await createAuditLog({
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      organizationId: user.organizationId ?? undefined,
      userId: platformOwner.id,
      metadata: { testFixture: true, role: account.role },
    })
    if (assignedPropertyIds.length) {
      await createAuditLog({
        action: "PROPERTY_ASSIGNED",
        entityType: "User",
        entityId: user.id,
        organizationId: user.organizationId ?? undefined,
        propertyId: assignedPropertyIds[0],
        userId: platformOwner.id,
        metadata: { testFixture: true, propertyIds: assignedPropertyIds },
      })
    }

    results.push({
      email: account.email,
      role: account.role,
      invitationStatus: invitation.status,
      clerkUserId,
      organizationId,
      propertyIds: assignedPropertyIds,
      departmentId,
    })
  }

  await ensureEmployeeProfile(organization.id, primaryProperty.id, department.id)

  console.log(JSON.stringify({
    testPassword: TEST_PASSWORD,
    organization: { id: organization.id, name: organization.name },
    properties: [
      { id: primaryProperty.id, name: primaryProperty.name },
      { id: secondaryProperty.id, name: secondaryProperty.name },
    ],
    department: { id: department.id, name: department.name },
    users: results,
  }, null, 2))
}

async function ensureTestHierarchy() {
  const organization = await prisma.organization.upsert({
    where: { slug: TEST_ORGANIZATION_SLUG },
    create: {
      name: TEST_ORGANIZATION_NAME,
      slug: TEST_ORGANIZATION_SLUG,
      legalBusinessName: "RBAC Validation Hotel Group LLC",
      contactName: "RBAC Test Owner",
      contactEmail: "testhrops@talentnesttest.com",
      organizationStatus: "ACTIVE",
      status: RecordStatus.ACTIVE,
      featureOverride: {
        create: {
          canUseScheduling: true,
          canUseAttendance: true,
          canUseTimesheets: true,
          canUseInvoices: true,
          canUsePayments: true,
          canUseReports: true,
          canUseKiosk: true,
          canUseStaffing: true,
          reason: "RBAC validation test fixture.",
        },
      },
      subscription: {
        create: {
          planKey: "test",
          planName: "RBAC Validation",
          billingCycle: "MANUAL",
          status: "ACTIVE",
          startedAt: new Date(),
        },
      },
    },
    update: {
      organizationStatus: "ACTIVE",
      status: RecordStatus.ACTIVE,
      featureOverride: {
        upsert: {
          create: {
            canUseScheduling: true,
            canUseAttendance: true,
            canUseTimesheets: true,
            canUseInvoices: true,
            canUsePayments: true,
            canUseReports: true,
            canUseKiosk: true,
            canUseStaffing: true,
            reason: "RBAC validation test fixture.",
          },
          update: {
            canUseScheduling: true,
            canUseAttendance: true,
            canUseTimesheets: true,
            canUseInvoices: true,
            canUsePayments: true,
            canUseReports: true,
            canUseKiosk: true,
            canUseStaffing: true,
            reason: "RBAC validation test fixture.",
          },
        },
      },
      subscription: {
        upsert: {
          create: {
            planKey: "test",
            planName: "RBAC Validation",
            billingCycle: "MANUAL",
            status: "ACTIVE",
            startedAt: new Date(),
          },
          update: {
            planKey: "test",
            planName: "RBAC Validation",
            billingCycle: "MANUAL",
            status: "ACTIVE",
          },
        },
      },
    },
  })

  const primaryProperty = await upsertProperty(organization.id, PRIMARY_PROPERTY_CODE, "RBAC Test Property One")
  const secondaryProperty = await upsertProperty(organization.id, SECONDARY_PROPERTY_CODE, "RBAC Test Property Two")
  const department = await prisma.department.upsert({
    where: { id: "rbac-validation-housekeeping" },
    create: {
      id: "rbac-validation-housekeeping",
      organizationId: organization.id,
      propertyId: primaryProperty.id,
      name: "Housekeeping",
      code: "HK",
      type: "HOUSEKEEPING",
      status: RecordStatus.ACTIVE,
    },
    update: {
      organizationId: organization.id,
      propertyId: primaryProperty.id,
      status: RecordStatus.ACTIVE,
    },
  })

  return { organization, primaryProperty, secondaryProperty, department }
}

async function upsertProperty(organizationId: string, code: string, name: string) {
  const existing = await prisma.property.findFirst({ where: { code } })
  if (existing) {
    return prisma.property.update({
      where: { id: existing.id },
      data: { organizationId, name, status: RecordStatus.ACTIVE },
    })
  }

  return prisma.property.create({
    data: {
      organizationId,
      code,
      name,
      brand: "TalentNest Test",
      status: RecordStatus.ACTIVE,
      city: "Test City",
      state: "PA",
      zipCode: "00000",
    },
  })
}

async function ensureAcceptedInvitation(account: TestAccount, organizationId: string | null, platformOwnerId: string) {
  const invitation = await prisma.userInvitation.upsert({
    where: { token: `rbac-validation-${account.role.toLowerCase().replaceAll("_", "-")}` },
    create: {
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      role: account.role,
      organizationId,
      status: OrganizationInvitationStatus.ACCEPTED,
      token: `rbac-validation-${account.role.toLowerCase().replaceAll("_", "-")}`,
      invitedByUserId: platformOwnerId,
      invitedAt: new Date(),
      sentAt: new Date(),
      acceptedAt: new Date(),
      expiresAt: addDays(new Date(), 7),
    },
    update: {
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      role: account.role,
      organizationId,
      status: OrganizationInvitationStatus.ACCEPTED,
      invitedByUserId: platformOwnerId,
      sentAt: new Date(),
      acceptedAt: new Date(),
      expiresAt: addDays(new Date(), 7),
      lastError: null,
    },
  })

  await createAuditLog({
    action: "USER_INVITED",
    entityType: "UserInvitation",
    entityId: invitation.id,
    organizationId: organizationId ?? undefined,
    userId: platformOwnerId,
    metadata: { testFixture: true, role: account.role, emailGenerated: true },
  })
  await createAuditLog({
    action: "INVITATION_ACCEPTED",
    entityType: "UserInvitation",
    entityId: invitation.id,
    organizationId: organizationId ?? undefined,
    userId: platformOwnerId,
    metadata: { testFixture: true, role: account.role },
  })

  return invitation
}

async function ensureClerkUser(
  clerk: Awaited<ReturnType<typeof clerkClient>>,
  account: TestAccount,
) {
  const existing = await clerk.users.getUserList({ emailAddress: [account.email] })
  const user = existing.data[0]
  if (user) {
    await clerk.users.updateUser(user.id, {
      password: TEST_PASSWORD,
      firstName: account.firstName,
      lastName: account.lastName,
    })
    return user.id
  }

  const created = await clerk.users.createUser({
    emailAddress: [account.email],
    password: TEST_PASSWORD,
    firstName: account.firstName,
    lastName: account.lastName,
  })
  return created.id
}

async function ensureEmployeeProfile(organizationId: string, propertyId: string, departmentId: string) {
  const existing = await prisma.employee.findFirst({
    where: { email: "testemployee@talentnesttest.com", organizationId },
  })

  if (existing) {
    await prisma.employee.update({
      where: { id: existing.id },
      data: {
        propertyId,
        departmentId,
        status: "ACTIVE",
      },
    })
    return
  }

  await prisma.employee.create({
    data: {
      organizationId,
      propertyId,
      departmentId,
      employeeNumber: "RBAC-EMP-001",
      firstName: "Test",
      lastName: "Employee",
      email: "testemployee@talentnesttest.com",
      employmentType: "DIRECT",
      position: "Housekeeping Associate",
      status: "ACTIVE",
    },
  })
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
