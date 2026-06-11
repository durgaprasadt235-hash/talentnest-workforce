import { Prisma, RecordStatus, WeeklyAttendanceBatchStatus } from "@prisma/client"

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

export async function listWeeklyAttendanceByRole(
  user: CurrentUser,
  filters: WeeklyAttendanceFilters = {},
) {
  const role = user.role

  if (
    role === "STAFFING_COMPANY_ADMIN" ||
    role === "STAFFING_COMPANY_COORDINATOR"
  ) {
    if (!user.staffingCompanyId) {
      return {
        batches: [],
        options: { organizations: [], properties: [] },
        message: "No staffing company is assigned to the current mock user.",
      }
    }
    return listStaffingCompanyBatches(user.staffingCompanyId, filters)
  }

  if (role === "FINANCE_USER") {
    return listFinanceBatches(filters)
  }

  if (role === "PROPERTY_MANAGER") {
    return listPropertyManagerBatches(user.propertyIds, filters)
  }

  if (role === "CORPORATE_ADMIN" || role === "ORGANIZATION_OWNER") {
    return listCorporateBatches(user.organizationId, filters)
  }

  return { batches: [], options: { organizations: [], properties: [] } }
}

async function listCorporateBatches(organizationId: string | undefined, filters: WeeklyAttendanceFilters) {
  const batchOrganizationId = filters.organizationId ?? organizationId
  const [batches, organizations, properties] = await Promise.all([
    prisma.weeklyAttendanceBatch.findMany({
      where: {
        organizationId: batchOrganizationId,
        propertyId: filters.propertyId,
        status: filters.status,
      },
      include: batchSummaryInclude,
      orderBy: [{ weekStartDate: "desc" }, { generatedAt: "desc" }],
    }),
    prisma.organization.findMany({
      where: { status: RecordStatus.ACTIVE },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.property.findMany({
      where: { status: RecordStatus.ACTIVE },
      select: { id: true, organizationId: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return { batches, options: { organizations, properties } }
}

async function listPropertyManagerBatches(propertyIds: string[] | undefined, filters: WeeklyAttendanceFilters) {
  const assignedPropertyIds = propertyIds ?? []
  const visiblePropertyIds = filters.propertyId
    ? assignedPropertyIds.filter((propertyId) => propertyId === filters.propertyId)
    : assignedPropertyIds
  const [batches, properties] = await Promise.all([
    prisma.weeklyAttendanceBatch.findMany({
      where: {
        propertyId: { in: visiblePropertyIds },
        organizationId: filters.organizationId,
        status: filters.status,
      },
      include: batchSummaryInclude,
      orderBy: [{ weekStartDate: "desc" }, { generatedAt: "desc" }],
    }),
    prisma.property.findMany({
      where: {
        id: { in: assignedPropertyIds },
        organizationId: filters.organizationId,
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

async function listFinanceBatches(filters: WeeklyAttendanceFilters) {
  const financeStatuses: WeeklyAttendanceBatchStatus[] = [
    WeeklyAttendanceBatchStatus.SENT_TO_FINANCE,
    WeeklyAttendanceBatchStatus.INVOICED,
    WeeklyAttendanceBatchStatus.PAID,
  ]
  const batches = await prisma.weeklyAttendanceBatch.findMany({
    where: {
      status: { in: financeStatuses },
      organizationId: filters.organizationId,
      propertyId: filters.propertyId,
      ...(filters.status && financeStatuses.includes(filters.status)
        ? { status: filters.status }
        : {}),
    },
    include: batchSummaryInclude,
    orderBy: [{ weekStartDate: "desc" }, { generatedAt: "desc" }],
  })

  const eligibleBatches = await prisma.weeklyAttendanceBatch.findMany({
    where: { status: { in: financeStatuses } },
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

/**
 * Get batch detail with role-based data filtering.
 */
export async function getWeeklyAttendanceBatchByRole(
  batchId: string,
  user: CurrentUser,
) {
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
  if (user.role === "STAFFING_COMPANY_ADMIN" || user.role === "STAFFING_COMPANY_COORDINATOR") {
    if (!user.staffingCompanyId) throw new Error("Unauthorized.")
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

  return batch
}
