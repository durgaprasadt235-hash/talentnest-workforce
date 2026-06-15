import { AuditType, Prisma } from "@prisma/client"

import { prisma } from "@/src/lib/prisma"
import type { CurrentUser } from "@/src/lib/rbac/current-user"
import { AuthorizationError } from "@/src/lib/rbac/errors"
import { Role } from "@/src/lib/rbac/roles"

export type AuditLogQuery = {
  action?: string
  entity?: string
  employeeId?: string
  propertyId?: string
  userId?: string
  role?: string
  message?: string
  dateFrom?: string
  dateTo?: string
  search?: string
  page: number
  pageSize: number
}

export async function listPlatformAuditLogs(user: CurrentUser, query: AuditLogQuery) {
  if (user.role !== Role.PLATFORM_OWNER) {
    throw new AuthorizationError("Only the platform owner can view platform audit logs.")
  }
  return listAuditLogs({ auditType: AuditType.PLATFORM }, query)
}

export async function listOrganizationAuditLogs(user: CurrentUser, query: AuditLogQuery) {
  if (user.role === Role.PLATFORM_OWNER || user.role === Role.PLATFORM_ADMIN) {
    throw new AuthorizationError("Platform users cannot view client operational audit logs.")
  }

  const scope: Prisma.AuditLogWhereInput = { auditType: AuditType.ORGANIZATION }
  if (user.role === Role.PROPERTY_MANAGER) {
    scope.organizationId = user.organizationId
    scope.propertyId = { in: user.propertyIds ?? [] }
  } else if (
    user.role === Role.EMPLOYEE ||
    user.role === Role.FRONT_DESK ||
    user.role === Role.HOUSEKEEPING ||
    user.role === Role.MAINTENANCE ||
    user.role === Role.NIGHT_AUDITOR
  ) {
    const employee = user.email
      ? await prisma.employee.findFirst({
          where: {
            organizationId: user.organizationId,
            email: { equals: user.email, mode: "insensitive" },
          },
          select: { id: true, propertyId: true },
        })
      : null
    if (!employee) throw new AuthorizationError("No employee activity is assigned to this user.")
    scope.organizationId = user.organizationId
    if (employee.propertyId) scope.propertyId = employee.propertyId
    scope.OR = [
      { employeeId: employee.id },
      { entityType: "Employee", entityId: employee.id },
    ]
  } else if (user.role === Role.DEPARTMENT_MANAGER) {
    if (!user.organizationId || !user.departmentId) {
      throw new AuthorizationError("No department is assigned to this department manager.")
    }
    scope.organizationId = user.organizationId
    scope.departmentId = user.departmentId
  } else if (user.organizationId) {
    scope.organizationId = user.organizationId
  } else {
    throw new AuthorizationError("You do not have access to organization audit logs.")
  }

  return listAuditLogs(scope, query)
}

async function listAuditLogs(scope: Prisma.AuditLogWhereInput, query: AuditLogQuery) {
  const where = await buildWhere(scope, query)
  const skip = (query.page - 1) * query.pageSize
  const [records, totalCount, actionGroups, entityGroups, properties, users, employees] =
    await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: {
          organization: { select: { id: true, name: true } },
          property: { select: { id: true, name: true } },
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize,
      }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.groupBy({ by: ["action"], where: scope, orderBy: { action: "asc" } }),
      prisma.auditLog.groupBy({ by: ["entityType"], where: scope, orderBy: { entityType: "asc" } }),
      prisma.property.findMany({
        where: propertyOptionScope(scope),
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: userOptionScope(scope),
        select: { id: true, firstName: true, lastName: true, role: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.employee.findMany({
        where: employeeOptionScope(scope),
        select: { id: true, firstName: true, lastName: true, employeeNumber: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ])

  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]))
  return {
    records: records.map((record) => ({
      ...record,
      employee:
        employeeMap.get(record.employeeId ?? "") ??
        (record.entityType === "Employee" ? employeeMap.get(record.entityId ?? "") : undefined) ??
        null,
    })),
    totalCount,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / query.pageSize)),
    options: {
      actions: actionGroups.map((item) => item.action),
      entities: entityGroups.map((item) => item.entityType),
      properties,
      users,
      employees,
      roles: [...new Set(users.map((item) => item.role))].sort(),
    },
  }
}

async function buildWhere(scope: Prisma.AuditLogWhereInput, query: AuditLogQuery) {
  const AND: Prisma.AuditLogWhereInput[] = [scope]
  if (query.action) AND.push({ action: query.action })
  if (query.entity) AND.push({ entityType: query.entity })
  if (query.propertyId) AND.push({ propertyId: query.propertyId })
  if (query.userId) AND.push({ userId: query.userId })
  if (query.role) AND.push({ user: { role: query.role } })
  if (query.employeeId) {
    AND.push({ OR: [{ employeeId: query.employeeId }, { entityType: "Employee", entityId: query.employeeId }] })
  }
  if (query.dateFrom || query.dateTo) {
    const createdAt: Prisma.DateTimeFilter = {}
    if (query.dateFrom) createdAt.gte = new Date(`${query.dateFrom}T00:00:00.000Z`)
    if (query.dateTo) createdAt.lte = new Date(`${query.dateTo}T23:59:59.999Z`)
    AND.push({ createdAt })
  }
  if (query.message) {
    AND.push(messageWhere(query.message))
  }
  if (query.search) {
    const matchingEmployees = await prisma.employee.findMany({
      where: {
        OR: [
          { firstName: { contains: query.search, mode: "insensitive" } },
          { lastName: { contains: query.search, mode: "insensitive" } },
          { employeeNumber: { contains: query.search, mode: "insensitive" } },
        ],
      },
      select: { id: true },
      take: 100,
    })
    AND.push({
      OR: [
        { action: { contains: query.search, mode: "insensitive" } },
        { entityType: { contains: query.search, mode: "insensitive" } },
        { property: { name: { contains: query.search, mode: "insensitive" } } },
        { employeeId: { in: matchingEmployees.map((item) => item.id) } },
        messageWhere(query.search),
      ],
    })
  }
  return { AND }
}

function messageWhere(value: string): Prisma.AuditLogWhereInput {
  return {
    OR: [
      { metadata: { path: ["message"], string_contains: value } },
      { metadata: { path: ["note"], string_contains: value } },
      { metadata: { path: ["reason"], string_contains: value } },
    ],
  }
}

function propertyOptionScope(scope: Prisma.AuditLogWhereInput): Prisma.PropertyWhereInput {
  if (scope.auditType === AuditType.PLATFORM) return { id: "__platform_has_no_properties__" }
  const propertyIds = scopedPropertyIds(scope)
  if (propertyIds) return { id: { in: propertyIds } }
  if (typeof scope.propertyId === "string") return { id: scope.propertyId }
  if (typeof scope.organizationId === "string") return { organizationId: scope.organizationId }
  return {}
}

function userOptionScope(scope: Prisma.AuditLogWhereInput): Prisma.UserWhereInput {
  if (scope.auditType === AuditType.PLATFORM) {
    return {
      role: { in: [Role.PLATFORM_OWNER, Role.PLATFORM_ADMIN] },
      auditLogs: { some: scope },
    }
  }
  return { auditLogs: { some: scope } }
}

function employeeOptionScope(scope: Prisma.AuditLogWhereInput): Prisma.EmployeeWhereInput {
  if (scope.auditType === AuditType.PLATFORM) return { id: "__platform_has_no_employees__" }
  const where: Prisma.EmployeeWhereInput = {}
  if (typeof scope.organizationId === "string") where.organizationId = scope.organizationId
  if (typeof scope.departmentId === "string") where.departmentId = scope.departmentId
  const propertyIds = scopedPropertyIds(scope)
  if (propertyIds) where.propertyId = { in: propertyIds }
  if (typeof scope.propertyId === "string") where.propertyId = scope.propertyId
  const employeeIds = scopedEmployeeIds(scope)
  if (employeeIds) where.id = { in: employeeIds }
  return where
}

function scopedPropertyIds(scope: Prisma.AuditLogWhereInput) {
  if (!scope.propertyId || typeof scope.propertyId !== "object" || !("in" in scope.propertyId)) return undefined
  return Array.isArray(scope.propertyId.in) ? scope.propertyId.in : undefined
}

function scopedEmployeeIds(scope: Prisma.AuditLogWhereInput) {
  if (!Array.isArray(scope.OR)) return undefined
  return scope.OR.flatMap((item) =>
    typeof item === "object" && item && typeof item.employeeId === "string"
      ? [item.employeeId]
      : [],
  )
}

export function auditLogExportResponse(
  records: Array<Record<string, unknown>>,
  format: "csv" | "excel",
) {
  const columns = ["id", "action", "entityType", "entityId", "organizationId", "propertyId", "userId", "createdAt", "metadata"]
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`
  const body = [
    columns.join(","),
    ...records.map((record) =>
      columns.map((column) => escape(column === "metadata" ? JSON.stringify(record[column] ?? {}) : record[column])).join(","),
    ),
  ].join("\n")
  return new Response(body, {
    headers: {
      "content-type": format === "excel" ? "application/vnd.ms-excel; charset=utf-8" : "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="audit-logs.${format === "excel" ? "xls" : "csv"}"`,
    },
  })
}

export function parseAuditLogQuery(url: URL): AuditLogQuery {
  const q = url.searchParams
  const page = Math.max(1, Number(q.get("page")) || 1)
  const requestedPageSize = Number(q.get("pageSize")) || 10
  return {
    action: q.get("action") || undefined,
    entity: q.get("entity") || undefined,
    employeeId: q.get("employeeId") || undefined,
    propertyId: q.get("propertyId") || undefined,
    userId: q.get("userId") || undefined,
    role: q.get("role") || undefined,
    message: q.get("message") || undefined,
    dateFrom: q.get("dateFrom") || undefined,
    dateTo: q.get("dateTo") || undefined,
    search: q.get("search") || undefined,
    page,
    pageSize: [5, 10, 25, 50].includes(requestedPageSize) ? requestedPageSize : 10,
  }
}
