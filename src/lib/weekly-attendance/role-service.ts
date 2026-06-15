import { AttendanceRecordStatus, Prisma, RecordStatus, WeeklyAttendanceBatchStatus } from "@prisma/client"

import type { CurrentUser } from "@/src/lib/rbac/current-user"
import { prisma } from "@/src/lib/prisma"

/**
 * Role-based weekly attendance data filtering.
 * Enforces visibility rules per role:
 * - Corporate Admin: all properties within organization
 * - Property Manager: assigned property only
 * - Staffing Company Admin: staffing company employees, approved/locked batches
 * - Finance User: approved/locked batches only
 * - Employee: own weekly summary only
 */

type WeeklyAttendanceFilters = {
  organizationId?: string
  propertyId?: string
  status?: WeeklyAttendanceBatchStatus
  weekStart?: string
}

const batchSummaryInclude = {
  organization: { select: { id: true, name: true } },
  property: { select: { id: true, name: true } },
  lines: {
    select: {
      totalHours: true,
      staffingCompanyId: true,
      approvalStatus: true,
    },
  },
  invoices: {
    select: {
      id: true,
      invoiceNumber: true,
      type: true,
      status: true,
      directHours: true,
      staffingHours: true,
      regularHours: true,
      overtimeHours: true,
      totalHours: true,
      totalAmount: true,
      staffingCompanyId: true,
      staffingCompany: { select: { id: true, displayName: true } },
    },
  },
  _count: { select: { lines: true } },
} satisfies Prisma.WeeklyAttendanceBatchInclude

const platformBatchSummaryInclude = {
  organization: { select: { id: true, name: true } },
  property: { select: { id: true, name: true } },
  _count: { select: { lines: true } },
} satisfies Prisma.WeeklyAttendanceBatchInclude

export async function listWeeklyAttendanceByRole(
  user: CurrentUser,
  filters: WeeklyAttendanceFilters = {},
) {
  const role = user.role
  let result

  if (
    role === "STAFFING_ADMIN" ||
    role === "STAFFING_BILLING"
  ) {
    if (!user.staffingCompanyId) {
      return {
        batches: [],
        options: { organizations: [], properties: [] },
        message: "No staffing company is assigned to the current user.",
      }
    }
    result = await listStaffingCompanyBatches(user.staffingCompanyId, filters)
  } else if (role === "PLATFORM_OWNER" || role === "PLATFORM_ADMIN") {
    result = await listPlatformBatches(filters)
  } else if (role === "FINANCE_USER") {
    result = await listFinanceBatches(user, filters)
  } else if (role === "PROPERTY_MANAGER") {
    result = await listPropertyManagerBatches(user, filters)
  } else if (role === "CORPORATE_ADMIN" || role === "ORGANIZATION_OWNER") {
    result = await listCorporateBatches(user, filters)
  } else {
    return { batches: [], options: { organizations: [], properties: [] }, closedRecordCount: 0 }
  }

  const closedRecordCount = filters.status ? 0 : await countClosedAttendance(user, filters)
  return {
    ...result,
    closedRecordCount,
    message:
      result.batches.length === 0 && closedRecordCount > 0
        ? "Closed attendance records found. Click Generate Weekly Attendance."
        : undefined,
  }
}

async function listCorporateBatches(user: CurrentUser, filters: WeeklyAttendanceFilters) {
  if (!user.organizationId) return { batches: [], options: { organizations: [], properties: [] } }
  const weekStartDate = filterWeekStart(filters.weekStart)
  const [batches, organizations, properties] = await Promise.all([
    prisma.weeklyAttendanceBatch.findMany({
      where: {
        organizationId: user.organizationId,
        propertyId: filters.propertyId,
        status: filters.status,
        weekStartDate,
      },
      include: batchSummaryInclude,
      orderBy: [{ weekStartDate: "desc" }, { generatedAt: "desc" }],
    }),
    prisma.organization.findMany({
      where: { id: user.organizationId, status: RecordStatus.ACTIVE },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.property.findMany({
      where: { organizationId: user.organizationId, status: RecordStatus.ACTIVE },
      select: { id: true, organizationId: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return { batches, options: { organizations, properties } }
}

async function listPropertyManagerBatches(user: CurrentUser, filters: WeeklyAttendanceFilters) {
  const assignedPropertyIds = user.propertyIds ?? []
  const visiblePropertyIds = filters.propertyId
    ? assignedPropertyIds.filter((propertyId) => propertyId === filters.propertyId)
    : assignedPropertyIds
  const [batches, properties] = await Promise.all([
    prisma.weeklyAttendanceBatch.findMany({
      where: {
        propertyId: { in: visiblePropertyIds },
        organizationId: user.organizationId,
        status: filters.status,
        weekStartDate: filterWeekStart(filters.weekStart),
      },
      include: batchSummaryInclude,
      orderBy: [{ weekStartDate: "desc" }, { generatedAt: "desc" }],
    }),
    prisma.property.findMany({
      where: {
        id: { in: assignedPropertyIds },
        organizationId: user.organizationId,
        status: RecordStatus.ACTIVE,
      },
      select: { id: true, organizationId: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  // Extract unique organizations
  const organizationIds = [...new Set(properties.map((p) => p.organizationId))]
  const organizations = await prisma.organization.findMany({
    where: { id: { in: organizationIds }, status: RecordStatus.ACTIVE },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return { batches, options: { organizations, properties } }
}

async function listStaffingCompanyBatches(staffingCompanyId: string, filters: WeeklyAttendanceFilters) {
  // Staffing company admins can only see approved/locked batches
  const batches = await prisma.weeklyAttendanceBatch.findMany({
    where: {
      status: {
        in: [
          WeeklyAttendanceBatchStatus.APPROVED,
          WeeklyAttendanceBatchStatus.LOCKED,
          WeeklyAttendanceBatchStatus.SENT_TO_CORPORATE,
          WeeklyAttendanceBatchStatus.SENT_TO_FINANCE,
          WeeklyAttendanceBatchStatus.INVOICED,
          WeeklyAttendanceBatchStatus.PAID,
        ],
      },
      organizationId: filters.organizationId,
      propertyId: filters.propertyId,
      weekStartDate: filterWeekStart(filters.weekStart),
      lines: {
        some: {
          employee: {
            staffingCompanyId,
          },
        },
      },
    },
    include: batchSummaryInclude,
    orderBy: [{ weekStartDate: "desc" }, { generatedAt: "desc" }],
  })

  // Extract organization/property options
  const organizationIds = [...new Set(batches.map((b) => b.organizationId))]
  const propertyIds = [...new Set(batches.map((b) => b.propertyId))]

  const [organizations, properties] = await Promise.all([
    prisma.organization.findMany({
      where: { id: { in: organizationIds }, status: RecordStatus.ACTIVE },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.property.findMany({
      where: { id: { in: propertyIds }, status: RecordStatus.ACTIVE },
      select: { id: true, organizationId: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return {
    batches: batches.map((batch) => ({
      ...batch,
      invoices: batch.invoices.filter((invoice) => invoice.staffingCompanyId === staffingCompanyId),
    })),
    options: { organizations, properties },
  }
}

async function listFinanceBatches(user: CurrentUser, filters: WeeklyAttendanceFilters) {
  if (!user.organizationId) return { batches: [], options: { organizations: [], properties: [] } }
  const financeStatuses: WeeklyAttendanceBatchStatus[] = [
    WeeklyAttendanceBatchStatus.SENT_TO_FINANCE,
    WeeklyAttendanceBatchStatus.INVOICED,
    WeeklyAttendanceBatchStatus.PAID,
  ]
  const batches = await prisma.weeklyAttendanceBatch.findMany({
    where: {
      status: { in: financeStatuses },
      organizationId: user.organizationId,
      propertyId: filters.propertyId,
      weekStartDate: filterWeekStart(filters.weekStart),
      ...(filters.status && financeStatuses.includes(filters.status)
        ? { status: filters.status }
        : {}),
    },
    include: batchSummaryInclude,
    orderBy: [{ weekStartDate: "desc" }, { generatedAt: "desc" }],
  })

  const eligibleBatches = await prisma.weeklyAttendanceBatch.findMany({
    where: { status: { in: financeStatuses }, organizationId: user.organizationId },
    select: { organizationId: true, propertyId: true },
  })
  const organizationIds = [...new Set(eligibleBatches.map((batch) => batch.organizationId))]
  const propertyIds = [...new Set(eligibleBatches.map((batch) => batch.propertyId))]

  const [organizations, properties] = await Promise.all([
    prisma.organization.findMany({
      where: { id: { in: organizationIds }, status: RecordStatus.ACTIVE },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.property.findMany({
      where: { id: { in: propertyIds }, status: RecordStatus.ACTIVE },
      select: { id: true, organizationId: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return { batches, options: { organizations, properties } }
}

async function listPlatformBatches(filters: WeeklyAttendanceFilters) {
  const where: Prisma.WeeklyAttendanceBatchWhereInput = {
    organizationId: filters.organizationId,
    propertyId: filters.propertyId,
    status: filters.status,
    weekStartDate: filterWeekStart(filters.weekStart),
  }
  const [batches, organizations, properties] = await Promise.all([
    prisma.weeklyAttendanceBatch.findMany({
      where,
      include: platformBatchSummaryInclude,
      orderBy: [{ weekStartDate: "desc" }, { generatedAt: "desc" }],
    }),
    prisma.organization.findMany({
      where: { status: RecordStatus.ACTIVE },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.property.findMany({
      where: { status: RecordStatus.ACTIVE, organizationId: filters.organizationId },
      select: { id: true, organizationId: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])
  return {
    batches: batches.map((batch) => ({ ...batch, lines: [], invoices: [] })),
    options: { organizations, properties },
  }
}

/**
 * Get batch detail with role-based data filtering.
 */
export async function getWeeklyAttendanceBatchByRole(
  batchId: string,
  user: CurrentUser,
) {
  if (user.role === "PLATFORM_OWNER" || user.role === "PLATFORM_ADMIN") {
    const summary = await prisma.weeklyAttendanceBatch.findUnique({
      where: { id: batchId },
      include: platformBatchSummaryInclude,
    })
    if (!summary) throw new Error("Weekly attendance batch not found.")
    return { ...summary, lines: [], invoices: [], summaryOnly: true }
  }

  const batchInclude = {
    organization: { select: { id: true, name: true } },
    property: { select: { id: true, name: true } },
    approvedByUser: { select: { id: true, firstName: true, lastName: true } },
    invoices: {
      include: { staffingCompany: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: "desc" },
    },
    lines: {
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            employmentType: true,
          },
        },
        department: { select: { id: true, name: true } },
        staffingCompany: { select: { id: true, displayName: true } },
      },
      orderBy: { employee: { lastName: "asc" } },
    },
  } satisfies Prisma.WeeklyAttendanceBatchInclude

  const batch = await prisma.weeklyAttendanceBatch.findUnique({
    where: { id: batchId },
    include: batchInclude,
  })

  if (!batch) throw new Error("Weekly attendance batch not found.")

  // Enforce visibility rules
  if (user.role === "STAFFING_ADMIN" || user.role === "STAFFING_BILLING") {
    if (!user.staffingCompanyId) throw new Error("Unauthorized.")
    if (!batch.lines.some((line) => line.staffingCompany?.id === user.staffingCompanyId)) {
      throw new Error("Unauthorized.")
    }
    if (
      batch.status !== WeeklyAttendanceBatchStatus.APPROVED &&
      batch.status !== WeeklyAttendanceBatchStatus.LOCKED &&
      batch.status !== WeeklyAttendanceBatchStatus.SENT_TO_CORPORATE &&
      batch.status !== WeeklyAttendanceBatchStatus.SENT_TO_FINANCE &&
      batch.status !== WeeklyAttendanceBatchStatus.INVOICED &&
      batch.status !== WeeklyAttendanceBatchStatus.PAID
    ) {
      throw new Error("Unauthorized.")
    }
    // Only show lines for this staffing company
    batch.lines = batch.lines.filter(
      (line) => line.staffingCompany?.id === user.staffingCompanyId,
    )
    batch.invoices = batch.invoices.filter(
      (invoice) => invoice.staffingCompany?.id === user.staffingCompanyId,
    )
  }

  if (user.role === "FINANCE_USER") {
    const visibleFinanceStatuses: WeeklyAttendanceBatchStatus[] = [
      WeeklyAttendanceBatchStatus.SENT_TO_FINANCE,
      WeeklyAttendanceBatchStatus.INVOICED,
      WeeklyAttendanceBatchStatus.PAID,
    ]
    if (!visibleFinanceStatuses.includes(batch.status)) {
      throw new Error("Unauthorized.")
    }
    if (user.organizationId && batch.organizationId !== user.organizationId) {
      throw new Error("Unauthorized.")
    }
  }

  if (user.role === "PROPERTY_MANAGER") {
    if (!user.propertyIds?.includes(batch.propertyId)) {
      throw new Error("Unauthorized.")
    }
  }

  if (user.role === "CORPORATE_ADMIN" || user.role === "ORGANIZATION_OWNER") {
    if (user.organizationId && batch.organizationId !== user.organizationId) {
      throw new Error("Unauthorized.")
    }
  }

  const punches = await prisma.attendanceRecord.findMany({
    where: {
      propertyId: batch.propertyId,
      employeeId: { in: batch.lines.map((line) => line.employeeId) },
      clockInAt: { gte: batch.weekStartDate, lt: addDays(batch.weekStartDate, 7) },
      clockOutAt: { not: null },
      status: { not: AttendanceRecordStatus.REJECTED },
    },
    include: {
      exceptions: {
        select: { id: true, exceptionType: true, reason: true, status: true },
      },
      correctionRequests: {
        select: {
          id: true,
          correctionType: true,
          reason: true,
          notes: true,
          status: true,
        },
      },
    },
    orderBy: { clockInAt: "asc" },
  })
  const punchesByEmployee = punches.reduce(
    (grouped, punch) => {
      const employeePunches = grouped.get(punch.employeeId) ?? []
      employeePunches.push(punch)
      grouped.set(punch.employeeId, employeePunches)
      return grouped
    },
    new Map<string, typeof punches>(),
  )

  return {
    ...batch,
    summaryOnly: false,
    lines: batch.lines.map((line) => ({
      ...line,
      punches: punchesByEmployee.get(line.employeeId) ?? [],
    })),
  }
}

async function countClosedAttendance(user: CurrentUser, filters: WeeklyAttendanceFilters) {
  if (
    user.role !== "ORGANIZATION_OWNER" &&
    user.role !== "CORPORATE_ADMIN" &&
    user.role !== "PROPERTY_MANAGER"
  ) {
    return 0
  }
  const where: Prisma.AttendanceRecordWhereInput = {
    organizationId: user.organizationId,
    propertyId:
      user.role === "PROPERTY_MANAGER"
        ? { in: filters.propertyId ? (user.propertyIds ?? []).filter((id) => id === filters.propertyId) : user.propertyIds ?? [] }
        : filters.propertyId,
    clockInAt: { not: null },
    clockOutAt: { not: null },
    status: { not: AttendanceRecordStatus.REJECTED },
  }
  const weekStartDate = filterWeekStart(filters.weekStart)
  if (weekStartDate) {
    where.clockInAt = { gte: weekStartDate, lt: addDays(weekStartDate, 7) }
  }
  return prisma.attendanceRecord.count({ where })
}

function filterWeekStart(value?: string) {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function addDays(value: Date, days: number) {
  const date = new Date(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date
}
