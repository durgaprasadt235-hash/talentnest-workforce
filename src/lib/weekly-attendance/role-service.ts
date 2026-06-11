import { EmploymentType, Prisma, RecordStatus, WeeklyAttendanceBatchStatus } from "@prisma/client"

import type { CurrentUser } from "@/src/lib/rbac/current-user"
import type { Role as BusinessRole } from "@/src/lib/rbac/roles"
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

export async function listWeeklyAttendanceByRole(user: CurrentUser) {
  const role = user.role

  if (
    role === "STAFFING_COMPANY_ADMIN" ||
    role === "STAFFING_COMPANY_COORDINATOR"
  ) {
    if (!user.staffingCompanyId) {
      return { batches: [], options: { organizations: [], properties: [] } }
    }
    return listStaffingCompanyBatches(user.staffingCompanyId)
  }

  if (role === "FINANCE_USER") {
    return listFinanceBatches()
  }

  if (role === "PROPERTY_MANAGER") {
    if (!user.propertyIds?.length) {
      return { batches: [], options: { organizations: [], properties: [] } }
    }
    return listPropertyManagerBatches(user.propertyIds)
  }

  if (role === "CORPORATE_ADMIN" || role === "ORGANIZATION_OWNER") {
    if (!user.organizationId) {
      return { batches: [], options: { organizations: [], properties: [] } }
    }
    return listCorporateBatches(user.organizationId)
  }

  return { batches: [], options: { organizations: [], properties: [] } }
}

async function listCorporateBatches(organizationId: string) {
  const [batches, organizations, properties] = await Promise.all([
    prisma.weeklyAttendanceBatch.findMany({
      where: { organizationId },
      include: {
        organization: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: [{ weekStartDate: "desc" }, { generatedAt: "desc" }],
    }),
    prisma.organization.findMany({
      where: { id: organizationId, status: RecordStatus.ACTIVE },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.property.findMany({
      where: {
        organizationId,
        status: RecordStatus.ACTIVE,
      },
      select: { id: true, organizationId: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return { batches, options: { organizations, properties } }
}

async function listPropertyManagerBatches(propertyIds: string[]) {
  const [batches, properties] = await Promise.all([
    prisma.weeklyAttendanceBatch.findMany({
      where: { propertyId: { in: propertyIds } },
      include: {
        organization: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: [{ weekStartDate: "desc" }, { generatedAt: "desc" }],
    }),
    prisma.property.findMany({
      where: { id: { in: propertyIds }, status: RecordStatus.ACTIVE },
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

async function listStaffingCompanyBatches(staffingCompanyId: string) {
  // Staffing company admins can only see approved/locked batches
  const batches = await prisma.weeklyAttendanceBatch.findMany({
    where: {
      status: { in: ["APPROVED", "LOCKED"] },
      lines: {
        some: {
          employee: {
            staffingCompanyId,
          },
        },
      },
    },
    include: {
      organization: { select: { id: true, name: true } },
      property: { select: { id: true, name: true } },
      _count: { select: { lines: true } },
    },
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

  return { batches, options: { organizations, properties } }
}

async function listFinanceBatches() {
  // Finance users can only see approved/locked batches
  const batches = await prisma.weeklyAttendanceBatch.findMany({
    where: { status: { in: ["APPROVED", "LOCKED"] } },
    include: {
      organization: { select: { id: true, name: true } },
      property: { select: { id: true, name: true } },
      _count: { select: { lines: true } },
    },
    orderBy: [{ weekStartDate: "desc" }, { generatedAt: "desc" }],
  })

  // Extract options
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
    if (batch.status !== WeeklyAttendanceBatchStatus.APPROVED && batch.status !== WeeklyAttendanceBatchStatus.LOCKED) {
      throw new Error("Unauthorized.")
    }
    // Only show lines for this staffing company
    batch.lines = batch.lines.filter(
      (line) => line.staffingCompany?.id === user.staffingCompanyId,
    )
  }

  if (user.role === "FINANCE_USER") {
    if (batch.status !== WeeklyAttendanceBatchStatus.APPROVED && batch.status !== WeeklyAttendanceBatchStatus.LOCKED) {
      throw new Error("Unauthorized.")
    }
  }

  if (user.role === "PROPERTY_MANAGER") {
    if (!user.propertyIds?.includes(batch.propertyId)) throw new Error("Unauthorized.")
  }

  if (user.role === "CORPORATE_ADMIN" || user.role === "ORGANIZATION_OWNER") {
    if (batch.organizationId !== user.organizationId) throw new Error("Unauthorized.")
  }

  return batch
}
