import { Prisma, RecordStatus } from "@prisma/client"

import { createAuditLog } from "@/src/lib/audit"
import type { LegalEntityInput } from "@/src/lib/master-data/validation"
import { prisma } from "@/src/lib/prisma"
import type { CurrentUser } from "@/src/lib/rbac/current-user"
import { AuthorizationError } from "@/src/lib/rbac/errors"
import { Role } from "@/src/lib/rbac/roles"

const legalEntitySelect = {
  id: true,
  organizationId: true,
  legalName: true,
  displayName: true,
  ein: true,
  address: true,
  city: true,
  state: true,
  zipCode: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  organization: { select: { id: true, name: true } },
  _count: { select: { properties: true } },
} satisfies Prisma.LegalEntitySelect

export async function listLegalEntities(user: CurrentUser) {
  const where = legalEntityScope(user)
  const [legalEntities, organizations] = await Promise.all([
    prisma.legalEntity.findMany({
      where,
      select: legalEntitySelect,
      orderBy: [{ organization: { name: "asc" } }, { displayName: "asc" }],
    }),
    prisma.organization.findMany({
      where:
        user.role === Role.PLATFORM_OWNER || user.role === Role.PLATFORM_ADMIN
          ? { status: RecordStatus.ACTIVE }
          : { id: user.organizationId ?? "", status: RecordStatus.ACTIVE },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return { legalEntities, options: { organizations } }
}

export async function createLegalEntity(input: LegalEntityInput, user: CurrentUser) {
  assertOrganizationScope(user, input.organizationId)
  const item = await prisma.legalEntity.create({
    data: normalize(input),
    select: legalEntitySelect,
  })
  await audit("CREATE_LEGAL_ENTITY", item.id, item.organizationId, user)
  return item
}

export async function updateLegalEntity(id: string, input: LegalEntityInput, user: CurrentUser) {
  const existing = await getLegalEntity(id)
  assertOrganizationScope(user, existing.organizationId)
  assertOrganizationScope(user, input.organizationId)

  const item = await prisma.legalEntity.update({
    where: { id },
    data: normalize(input),
    select: legalEntitySelect,
  })
  await audit("UPDATE_LEGAL_ENTITY", item.id, item.organizationId, user)
  return item
}

export async function setLegalEntityStatus(id: string, status: RecordStatus, user: CurrentUser) {
  const existing = await getLegalEntity(id)
  assertOrganizationScope(user, existing.organizationId)
  const item = await prisma.legalEntity.update({
    where: { id },
    data: { status },
    select: legalEntitySelect,
  })
  await audit(
    status === RecordStatus.ACTIVE ? "REACTIVATE_LEGAL_ENTITY" : "DEACTIVATE_LEGAL_ENTITY",
    item.id,
    item.organizationId,
    user,
  )
  return item
}

function legalEntityScope(user: CurrentUser): Prisma.LegalEntityWhereInput | undefined {
  if (user.role === Role.PLATFORM_OWNER || user.role === Role.PLATFORM_ADMIN) return undefined
  if (
    (user.role === Role.ORGANIZATION_OWNER || user.role === Role.CORPORATE_ADMIN) &&
    user.organizationId
  ) {
    return { organizationId: user.organizationId }
  }
  throw new AuthorizationError("You do not have permission to view legal entities.")
}

function assertOrganizationScope(user: CurrentUser, organizationId: string) {
  if (user.role === Role.PLATFORM_OWNER || user.role === Role.PLATFORM_ADMIN) return
  if (
    (user.role === Role.ORGANIZATION_OWNER || user.role === Role.CORPORATE_ADMIN) &&
    user.organizationId === organizationId
  ) {
    return
  }
  throw new AuthorizationError("You cannot manage legal entities outside your organization.")
}

async function getLegalEntity(id: string) {
  const item = await prisma.legalEntity.findUnique({
    where: { id },
    select: { id: true, organizationId: true },
  })
  if (!item) throw new Error("Legal entity not found.")
  return item
}

function normalize(input: LegalEntityInput) {
  return {
    ...input,
    ein: input.ein || null,
    address: input.address || null,
    city: input.city || null,
    state: input.state || null,
    zipCode: input.zipCode || null,
  }
}

function audit(action: string, id: string, organizationId: string, user: CurrentUser) {
  return createAuditLog({
    action,
    entityType: "LegalEntity",
    entityId: id,
    organizationId,
    userId: user.id,
  })
}
