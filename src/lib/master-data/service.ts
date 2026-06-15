import { Prisma, RecordStatus } from "@prisma/client"

import { createAuditLog } from "@/src/lib/audit"
import type { DepartmentInput, OrganizationInput, PropertyInput } from "@/src/lib/master-data/validation"
import { prisma } from "@/src/lib/prisma"
import type { CurrentUser } from "@/src/lib/rbac/current-user"
import { Role } from "@/src/lib/rbac/roles"

const organizationSelect = {
  id: true, name: true, slug: true, legalBusinessName: true, contactName: true,
  contactEmail: true, contactPhone: true, billingAddress: true, billingCity: true,
  billingState: true, billingZip: true, organizationStatus: true, status: true,
  subscription: true,
  featureOverride: true,
  users: {
    where: { role: { notIn: ["PLATFORM_OWNER", "PLATFORM_ADMIN"] } },
    select: { id: true, firstName: true, lastName: true, email: true, clerkUserId: true, role: true },
    orderBy: { createdAt: "asc" },
  },
  invitations: {
    select: {
      id: true, email: true, status: true, invitedAt: true, sentAt: true,
      expiresAt: true, lastError: true,
    },
    orderBy: { invitedAt: "desc" },
  },
  _count: { select: { legalEntities: true, properties: true } },
} satisfies Prisma.OrganizationSelect
const propertySelect = {
  id: true, organizationId: true, legalEntityId: true, name: true, code: true, status: true,
  brand: true, address: true, addressLine2: true, city: true, state: true, zipCode: true, timeZone: true,
  organization: { select: { id: true, name: true } },
  legalEntity: { select: { id: true, displayName: true } },
} satisfies Prisma.PropertySelect
const departmentSelect = {
  id: true, organizationId: true, propertyId: true, name: true, code: true, type: true, status: true,
  organization: { select: { id: true, name: true } },
  property: { select: { id: true, name: true } },
} satisfies Prisma.DepartmentSelect

export function listOrganizations(actor: CurrentUser) {
  const where =
    actor.role === Role.PLATFORM_OWNER || actor.role === Role.PLATFORM_ADMIN
      ? undefined
      : { id: actor.organizationId ?? "" }
  return prisma.organization.findMany({ where, select: organizationSelect, orderBy: { name: "asc" } })
}

export async function createOrganization(input: OrganizationInput) {
  await ensureUniqueSlug(input.slug)
  const item = await prisma.organization.create({ data: input, select: organizationSelect })
  await audit("CREATE_ORGANIZATION", "Organization", item.id, item.id)
  return item
}

export async function updateOrganization(id: string, input: OrganizationInput) {
  await ensureUniqueSlug(input.slug, id)
  const item = await prisma.organization.update({ where: { id }, data: input, select: organizationSelect })
  await audit("UPDATE_ORGANIZATION", "Organization", item.id, item.id)
  return item
}

export async function setOrganizationStatus(id: string, status: RecordStatus) {
  const item = await prisma.organization.update({ where: { id }, data: { status }, select: organizationSelect })
  await audit(status === RecordStatus.ACTIVE ? "REACTIVATE_ORGANIZATION" : "DEACTIVATE_ORGANIZATION", "Organization", item.id, item.id)
  return item
}

export async function assignOrganizationOwner(
  organizationId: string,
  userId: string,
  actor: CurrentUser,
) {
  if (actor.role !== Role.PLATFORM_OWNER) {
    throw new Error("Only the platform owner can assign organization owners.")
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, organizationId: true },
  })
  if (!user || user.organizationId !== organizationId) {
    throw new Error("User is not assigned to this organization.")
  }
  await prisma.user.updateMany({
    where: { organizationId, role: Role.ORGANIZATION_OWNER, id: { not: userId } },
    data: { role: Role.CORPORATE_ADMIN },
  })
  const owner = await prisma.user.update({
    where: { id: userId },
    data: { role: Role.ORGANIZATION_OWNER },
  })
  await audit("ASSIGN_ORGANIZATION_OWNER", "User", owner.id, organizationId)
  return owner
}

export async function listProperties(actor: CurrentUser) {
  const scope = actorScope(actor)
  const [properties, organizations, legalEntities] = await Promise.all([
    prisma.property.findMany({ where: scope.property, select: propertySelect, orderBy: { name: "asc" } }),
    prisma.organization.findMany({ where: { status: RecordStatus.ACTIVE, ...scope.organization }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.legalEntity.findMany({ where: scope.legalEntity, select: { id: true, organizationId: true, displayName: true }, orderBy: { displayName: "asc" } }),
  ])
  return { properties, options: { organizations, legalEntities } }
}

export async function createProperty(input: PropertyInput, actor: CurrentUser) {
  assertOrganizationScope(actor, input.organizationId)
  await ensurePropertyAssignment(input, true)
  const item = await prisma.property.create({ data: normalizeProperty(input), select: propertySelect })
  await audit("CREATE_PROPERTY", "Property", item.id, item.organizationId, item.id)
  return item
}

export async function updateProperty(id: string, input: PropertyInput, actor: CurrentUser) {
  assertOrganizationScope(actor, input.organizationId)
  await ensurePropertyAssignment(input, false)
  const item = await prisma.property.update({ where: { id }, data: normalizeProperty(input), select: propertySelect })
  await audit("UPDATE_PROPERTY", "Property", item.id, item.organizationId, item.id)
  return item
}

export async function setPropertyStatus(id: string, status: RecordStatus, actor: CurrentUser) {
  const existing = await prisma.property.findUnique({ where: { id }, select: { organizationId: true } })
  if (!existing) throw new Error("Property not found.")
  assertOrganizationScope(actor, existing.organizationId)
  const item = await prisma.property.update({ where: { id }, data: { status }, select: propertySelect })
  await audit(status === RecordStatus.ACTIVE ? "REACTIVATE_PROPERTY" : "DEACTIVATE_PROPERTY", "Property", item.id, item.organizationId, item.id)
  return item
}

export async function listDepartments(actor: CurrentUser) {
  const scope = actorScope(actor)
  const [departments, organizations, properties] = await Promise.all([
    prisma.department.findMany({ where: scope.department, select: departmentSelect, orderBy: { name: "asc" } }),
    prisma.organization.findMany({ where: { status: RecordStatus.ACTIVE, ...scope.organization }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.property.findMany({ where: { status: RecordStatus.ACTIVE, ...scope.property }, select: { id: true, organizationId: true, name: true }, orderBy: { name: "asc" } }),
  ])
  return { departments, options: { organizations, properties } }
}

export async function createDepartment(input: DepartmentInput, actor: CurrentUser) {
  assertPropertyScope(actor, input.organizationId, input.propertyId)
  await ensureDepartmentAssignment(input)
  const item = await prisma.department.create({
    data: {
      ...input,
      code: input.code || null,
      roles: {
        create: defaultDepartmentRoles.map((role) => ({ ...role, status: RecordStatus.ACTIVE })),
      },
    },
    select: departmentSelect,
  })
  await audit("CREATE_DEPARTMENT", "Department", item.id, item.organizationId, item.propertyId)
  return item
}

export async function updateDepartment(id: string, input: DepartmentInput, actor: CurrentUser) {
  assertPropertyScope(actor, input.organizationId, input.propertyId)
  await ensureDepartmentAssignment(input)
  const item = await prisma.department.update({ where: { id }, data: { ...input, code: input.code || null }, select: departmentSelect })
  await audit("UPDATE_DEPARTMENT", "Department", item.id, item.organizationId, item.propertyId)
  return item
}

export async function setDepartmentStatus(id: string, status: RecordStatus, actor: CurrentUser) {
  const existing = await prisma.department.findUnique({ where: { id }, select: { organizationId: true, propertyId: true } })
  if (!existing) throw new Error("Department not found.")
  assertPropertyScope(actor, existing.organizationId, existing.propertyId)
  const item = await prisma.department.update({ where: { id }, data: { status }, select: departmentSelect })
  await audit(status === RecordStatus.ACTIVE ? "REACTIVATE_DEPARTMENT" : "DEACTIVATE_DEPARTMENT", "Department", item.id, item.organizationId, item.propertyId)
  return item
}

async function ensureUniqueSlug(slug: string, id?: string) {
  const existing = await prisma.organization.findUnique({ where: { slug }, select: { id: true } })
  if (existing && existing.id !== id) throw new Error("Organization slug must be unique.")
}

async function ensureOrganization(id: string) {
  if (!(await prisma.organization.findUnique({ where: { id }, select: { id: true } }))) {
    throw new Error("Organization not found.")
  }
}

async function ensurePropertyAssignment(input: PropertyInput, requireLegalEntityWhenAvailable: boolean) {
  await ensureOrganization(input.organizationId)
  if (input.legalEntityId) {
    const legalEntity = await prisma.legalEntity.findUnique({
      where: { id: input.legalEntityId },
      select: { organizationId: true },
    })
    if (!legalEntity) throw new Error("Legal entity not found.")
    if (legalEntity.organizationId !== input.organizationId) {
      throw new Error("Legal entity does not belong to the selected organization.")
    }
    return
  }

  if (
    requireLegalEntityWhenAvailable &&
    (await prisma.legalEntity.count({ where: { organizationId: input.organizationId } })) > 0
  ) {
    throw new Error("Legal entity is required for new properties in this organization.")
  }
}

async function ensureDepartmentAssignment(input: DepartmentInput) {
  const property = await prisma.property.findUnique({ where: { id: input.propertyId }, select: { organizationId: true } })
  if (!property) throw new Error("Property not found.")
  if (property.organizationId !== input.organizationId) throw new Error("Property does not belong to the selected organization.")
}

function normalizeProperty(input: PropertyInput) {
  return { ...input, code: input.code || null, brand: input.brand || null, legalEntityId: input.legalEntityId || null, address: input.address || null, addressLine2: input.addressLine2 || null, city: input.city || null, state: input.state || null, zipCode: input.zipCode || null }
}

function actorScope(actor: CurrentUser) {
  if (actor.role === Role.PLATFORM_OWNER || actor.role === Role.PLATFORM_ADMIN) {
    return { organization: {}, property: {}, legalEntity: {}, department: {} }
  }
  const organizationId = actor.organizationId ?? ""
  const property =
    actor.role === Role.PROPERTY_MANAGER
      ? { id: { in: actor.propertyIds ?? [] } }
      : { organizationId }
  return {
    organization: { id: organizationId },
    property,
    legalEntity: { organizationId },
    department:
      actor.role === Role.PROPERTY_MANAGER
        ? { propertyId: { in: actor.propertyIds ?? [] } }
        : { organizationId },
  }
}

function assertOrganizationScope(actor: CurrentUser, organizationId: string) {
  if (actor.role === Role.PLATFORM_OWNER || actor.role === Role.PLATFORM_ADMIN) return
  if (actor.organizationId !== organizationId) throw new Error("Unauthorized.")
}

function assertPropertyScope(actor: CurrentUser, organizationId: string, propertyId: string) {
  assertOrganizationScope(actor, organizationId)
  if (
    actor.role === Role.PROPERTY_MANAGER &&
    !actor.propertyIds?.includes(propertyId)
  ) {
    throw new Error("This property is not assigned to the current property manager.")
  }
}

function audit(action: string, entityType: string, entityId: string, organizationId: string, propertyId?: string) {
  return createAuditLog({ action, entityType, entityId, organizationId, propertyId })
}

const defaultDepartmentRoles = [
  { name: "Front Desk Agent", code: "FRONT_DESK_AGENT", isManager: false, canApproveAttendance: false, canManageSchedule: false },
  { name: "Night Auditor", code: "NIGHT_AUDITOR", isManager: false, canApproveAttendance: false, canManageSchedule: false },
  { name: "Housekeeper", code: "HOUSEKEEPER", isManager: false, canApproveAttendance: false, canManageSchedule: false },
  { name: "Maintenance Technician", code: "MAINTENANCE_TECH", isManager: false, canApproveAttendance: false, canManageSchedule: false },
  { name: "Property Manager", code: "PROPERTY_MANAGER", isManager: true, canApproveAttendance: true, canManageSchedule: true },
  { name: "Assistant General Manager", code: "ASSISTANT_GM", isManager: true, canApproveAttendance: true, canManageSchedule: true },
  { name: "General Manager", code: "GENERAL_MANAGER", isManager: true, canApproveAttendance: true, canManageSchedule: true },
]
