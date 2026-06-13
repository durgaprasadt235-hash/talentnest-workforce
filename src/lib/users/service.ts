import { Prisma, RecordStatus } from "@prisma/client"

import { createAuditLog } from "@/src/lib/audit"
import { prisma } from "@/src/lib/prisma"
import type { CurrentUser } from "@/src/lib/rbac/current-user"
import { AuthorizationError } from "@/src/lib/rbac/errors"
import { Role, ROLES, type Role as RoleType } from "@/src/lib/rbac/roles"
import type { UserInput } from "@/src/lib/users/validation"

const platformRoles: RoleType[] = [Role.PLATFORM_OWNER, Role.PLATFORM_ADMIN]
const staffingRoles: RoleType[] = [Role.STAFFING_ADMIN, Role.STAFFING_BILLING]

const userInclude = {
  organization: { select: { id: true, name: true } },
  staffingCompany: { select: { id: true, displayName: true } },
  propertyAccesses: {
    select: { property: { select: { id: true, name: true } } },
    orderBy: { property: { name: "asc" } },
  },
} satisfies Prisma.UserInclude

export async function listUsersAndAccess(actor: CurrentUser) {
  assertCanViewUsers(actor)
  const scope = userScope(actor)

  const [users, organizations, properties, staffingCompanies] = await Promise.all([
    prisma.user.findMany({
      where: scope,
      include: userInclude,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.organization.findMany({
      where: actor.organizationId ? { id: actor.organizationId } : undefined,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.property.findMany({
      where: actor.organizationId ? { organizationId: actor.organizationId } : undefined,
      select: { id: true, name: true, organizationId: true },
      orderBy: { name: "asc" },
    }),
    prisma.staffingCompany.findMany({
      where: actor.organizationId ? { organizationId: actor.organizationId } : undefined,
      select: { id: true, displayName: true, organizationId: true },
      orderBy: { displayName: "asc" },
    }),
  ])

  return {
    users: users.map((user) => ({
      ...user,
      propertyIds: user.propertyAccesses.map((access) => access.property.id),
      properties: user.propertyAccesses.map((access) => access.property),
      clerkLinked: Boolean(user.clerkUserId),
      canManage: canManageUser(actor, user),
      propertyAccesses: undefined,
    })),
    options: {
      organizations,
      properties,
      staffingCompanies,
      roles: manageableRoles(actor),
    },
  }
}

export async function createUser(input: UserInput, actor: CurrentUser) {
  assertCanAssignRole(actor, input.role)
  const normalized = await validateAssignment(input, actor)

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        firstName: normalized.firstName,
        lastName: normalized.lastName,
        email: normalized.email,
        role: normalized.role,
        organizationId: normalized.organizationId,
        staffingCompanyId: normalized.staffingCompanyId,
        status: normalized.status,
        propertyAccesses: {
          create: normalized.propertyIds.map((propertyId) => ({ propertyId })),
        },
      },
      include: userInclude,
    })
    return created
  })

  await auditUser("CREATE_USER", user.id, actor, user.organizationId)
  return user
}

export async function updateUser(id: string, input: UserInput, actor: CurrentUser) {
  const target = await getTarget(id)
  assertCanManageUser(actor, target)
  assertCanAssignRole(actor, input.role)
  const normalized = await validateAssignment(input, actor)

  const user = await prisma.$transaction(async (tx) => {
    await tx.userPropertyAccess.deleteMany({ where: { userId: id } })
    return tx.user.update({
      where: { id },
      data: {
        firstName: normalized.firstName,
        lastName: normalized.lastName,
        email: normalized.email,
        role: normalized.role,
        organizationId: normalized.organizationId,
        staffingCompanyId: normalized.staffingCompanyId,
        status: normalized.status,
        propertyAccesses: {
          create: normalized.propertyIds.map((propertyId) => ({ propertyId })),
        },
      },
      include: userInclude,
    })
  })

  await auditUser("UPDATE_USER_ACCESS", user.id, actor, user.organizationId)
  return user
}

export async function setUserStatus(id: string, status: RecordStatus, actor: CurrentUser) {
  const target = await getTarget(id)
  assertCanManageUser(actor, target)
  if (actor.id === id && status === RecordStatus.INACTIVE) {
    throw new AuthorizationError("You cannot deactivate your own account.")
  }

  const user = await prisma.user.update({
    where: { id },
    data: { status },
    include: userInclude,
  })
  await auditUser(status === RecordStatus.ACTIVE ? "REACTIVATE_USER" : "DEACTIVATE_USER", id, actor, user.organizationId)
  return user
}

function userScope(actor: CurrentUser): Prisma.UserWhereInput | undefined {
  if (actor.role === Role.PLATFORM_OWNER || actor.role === Role.PLATFORM_ADMIN) return undefined
  if (actor.organizationId) return { organizationId: actor.organizationId }
  throw new AuthorizationError("You do not have permission to view users.")
}

function assertCanViewUsers(actor: CurrentUser) {
  if (!manageableRoles(actor).length) {
    throw new AuthorizationError("You do not have permission to view users.")
  }
}

function manageableRoles(actor: CurrentUser): RoleType[] {
  switch (actor.role) {
    case Role.PLATFORM_OWNER:
      return [...ROLES]
    case Role.PLATFORM_ADMIN:
      return ROLES.filter((role) => !platformRoles.includes(role))
    case Role.ORGANIZATION_OWNER:
      return ROLES.filter((role) => !platformRoles.includes(role))
    case Role.CORPORATE_ADMIN:
      return ROLES.filter(
        (role) => !platformRoles.includes(role) && role !== Role.ORGANIZATION_OWNER,
      )
    default:
      return []
  }
}

function canManageUser(actor: CurrentUser, target: { role: string; organizationId: string | null }) {
  if (actor.role === Role.PLATFORM_OWNER) return true
  if (actor.role === Role.PLATFORM_ADMIN) return !platformRoles.includes(target.role as RoleType)
  if (!actor.organizationId || actor.organizationId !== target.organizationId) return false
  if (actor.role === Role.ORGANIZATION_OWNER) return !platformRoles.includes(target.role as RoleType)
  return actor.role === Role.CORPORATE_ADMIN && target.role !== Role.ORGANIZATION_OWNER && !platformRoles.includes(target.role as RoleType)
}

function assertCanManageUser(actor: CurrentUser, target: { role: string; organizationId: string | null }) {
  if (!canManageUser(actor, target)) {
    throw new AuthorizationError("You do not have permission to manage this user.")
  }
}

function assertCanAssignRole(actor: CurrentUser, role: RoleType) {
  if (!manageableRoles(actor).includes(role)) {
    throw new AuthorizationError("You do not have permission to assign this role.")
  }
}

async function validateAssignment(input: UserInput, actor: CurrentUser): Promise<UserInput> {
  const organizationId = actor.organizationId ?? input.organizationId ?? null
  const isPlatform = platformRoles.includes(input.role)

  if (isPlatform) {
    return { ...input, organizationId: null, staffingCompanyId: null, propertyIds: [] }
  }
  if (!organizationId) throw new Error("Organization is required for this role.")

  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })
  if (!organization) throw new Error("Organization not found.")

  const staffingCompanyId = staffingRoles.includes(input.role) ? input.staffingCompanyId ?? null : null
  if (staffingRoles.includes(input.role) && !staffingCompanyId) {
    throw new Error("Staffing company is required for this role.")
  }
  if (staffingCompanyId) {
    const staffing = await prisma.staffingCompany.findUnique({ where: { id: staffingCompanyId }, select: { organizationId: true } })
    if (!staffing || staffing.organizationId !== organizationId) {
      throw new Error("Staffing company does not belong to the selected organization.")
    }
  }

  const propertyIds = input.role === Role.PROPERTY_MANAGER ? [...new Set(input.propertyIds)] : []
  if (propertyIds.length) {
    const count = await prisma.property.count({ where: { id: { in: propertyIds }, organizationId } })
    if (count !== propertyIds.length) throw new Error("One or more properties do not belong to the selected organization.")
  }

  return { ...input, organizationId, staffingCompanyId, propertyIds }
}

async function getTarget(id: string) {
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, organizationId: true } })
  if (!target) throw new Error("User not found.")
  return target
}

function auditUser(action: string, userId: string, actor: CurrentUser, organizationId: string | null) {
  return createAuditLog({
    action,
    entityType: "User",
    entityId: userId,
    userId: actor.id,
    organizationId: organizationId ?? actor.organizationId,
  })
}
