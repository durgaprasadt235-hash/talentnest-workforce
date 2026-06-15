import { Prisma } from "@prisma/client"

import { errorResponse } from "@/src/lib/http"
import { prisma } from "@/src/lib/prisma"
import { Permission } from "@/src/lib/rbac/permissions"
import { Role } from "@/src/lib/rbac/roles"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

const PAGE_SIZES = [5, 10, 25]

export async function GET(request: Request) {
  try {
    const user = await requireServerPermission(request, Permission.VIEW_AUDIT_LOGS)
    const query = new URL(request.url).searchParams
    const pageSize = PAGE_SIZES.includes(Number(query.get("pageSize")))
      ? Number(query.get("pageSize"))
      : 10
    const page = Math.max(1, Number(query.get("page")) || 1)
    const scopedWhere = auditScope(user)
    const where: Prisma.AuditLogWhereInput = {
      AND: [
        scopedWhere,
        query.get("action") ? { action: query.get("action")! } : {},
        query.get("entity") || query.get("entityType")
          ? { entityType: (query.get("entity") ?? query.get("entityType"))! }
          : {},
        query.get("propertyId") ? { propertyId: query.get("propertyId")! } : {},
        query.get("userId") ? { userId: query.get("userId")! } : {},
        query.get("role") ? { user: { role: query.get("role")! } } : {},
        employeeFilter(query.get("employeeId")),
        messageFilter(query.get("message")),
        dateFilter(query.get("dateFrom"), query.get("dateTo")),
      ],
    }

    const totalCount = await prisma.auditLog.count({ where })
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const safePage = Math.min(page, totalPages)
    const [records, actionGroups, entityGroups, properties, users, employees] =
      await prisma.$transaction([
        prisma.auditLog.findMany({
          where,
          include: {
            organization: { select: { id: true, name: true } },
            property: { select: { id: true, name: true } },
            user: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (safePage - 1) * pageSize,
          take: pageSize,
        }),
        prisma.auditLog.groupBy({
          by: ["action"],
          where: scopedWhere,
          orderBy: { action: "asc" },
        }),
        prisma.auditLog.groupBy({
          by: ["entityType"],
          where: scopedWhere,
          orderBy: { entityType: "asc" },
        }),
        prisma.property.findMany({
          where: propertyScope(user),
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.user.findMany({
          where: userScope(user),
          select: { id: true, firstName: true, lastName: true, role: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        }),
        prisma.employee.findMany({
          where: employeeScope(user),
          select: { id: true, firstName: true, lastName: true, employeeNumber: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        }),
      ])

    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]))
    const enrichedRecords = records.map((record) => {
      const metadata = isRecord(record.metadata) ? record.metadata : {}
      const employeeId =
        record.entityType === "Employee" ? record.entityId : stringValue(metadata.employeeId)
      return { ...record, employee: employeeId ? employeeMap.get(employeeId) ?? null : null }
    })
    return Response.json({
      records: enrichedRecords,
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      options: {
        actions: actionGroups.map(({ action }) => action),
        entities: entityGroups.map(({ entityType }) => entityType),
        employees,
        properties,
        users,
        roles: [...new Set(users.map(({ role }) => role))].sort(),
      },
    })
  } catch (error) {
    return errorResponse(error, 500)
  }
}

function auditScope(user: { role: Role; organizationId?: string; propertyIds?: string[] }): Prisma.AuditLogWhereInput {
  if (user.role === Role.PLATFORM_OWNER || user.role === Role.PLATFORM_ADMIN) return {}
  if (user.role === Role.PROPERTY_MANAGER) return { propertyId: { in: user.propertyIds ?? [] } }
  if (user.organizationId) return { organizationId: user.organizationId }
  return { id: "__NO_AUDIT_LOG_ACCESS__" }
}

function propertyScope(user: { role: Role; organizationId?: string; propertyIds?: string[] }): Prisma.PropertyWhereInput {
  if (user.role === Role.PLATFORM_OWNER || user.role === Role.PLATFORM_ADMIN) return {}
  if (user.role === Role.PROPERTY_MANAGER) return { id: { in: user.propertyIds ?? [] } }
  return { organizationId: user.organizationId ?? "__NO_ORGANIZATION__" }
}

function userScope(user: { role: Role; organizationId?: string }): Prisma.UserWhereInput {
  if (user.role === Role.PLATFORM_OWNER || user.role === Role.PLATFORM_ADMIN) return {}
  return { organizationId: user.organizationId ?? "__NO_ORGANIZATION__" }
}

function employeeScope(user: { role: Role; organizationId?: string; propertyIds?: string[] }): Prisma.EmployeeWhereInput {
  if (user.role === Role.PLATFORM_OWNER || user.role === Role.PLATFORM_ADMIN) return {}
  if (user.role === Role.PROPERTY_MANAGER) return { propertyId: { in: user.propertyIds ?? [] } }
  return { organizationId: user.organizationId ?? "__NO_ORGANIZATION__" }
}

function employeeFilter(employeeId: string | null): Prisma.AuditLogWhereInput {
  if (!employeeId) return {}
  return {
    OR: [
      { entityType: "Employee", entityId: employeeId },
      { metadata: { path: ["employeeId"], equals: employeeId } },
    ],
  }
}

function messageFilter(message: string | null): Prisma.AuditLogWhereInput {
  if (!message) return {}
  return {
    OR: [
      { metadata: { path: ["message"], string_contains: message, mode: "insensitive" } },
      { metadata: { path: ["note"], string_contains: message, mode: "insensitive" } },
    ],
  }
}

function dateFilter(dateFrom: string | null, dateTo: string | null): Prisma.AuditLogWhereInput {
  if (!dateFrom && !dateTo) return {}
  const createdAt: Prisma.DateTimeFilter = {}
  if (dateFrom) createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`)
  if (dateTo) createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`)
  return { createdAt }
}

function isRecord(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function stringValue(value: Prisma.JsonValue | undefined) {
  return typeof value === "string" ? value : undefined
}
