import {
  Prisma,
  RecordStatus,
  WeeklyAttendanceInvoiceStatus,
  WeeklyAttendanceInvoiceType,
} from "@prisma/client"

import { createAuditLog } from "@/src/lib/audit"
import { prisma } from "@/src/lib/prisma"
import type { CurrentUser } from "@/src/lib/rbac/current-user"
import { AuthorizationError } from "@/src/lib/rbac/server-guard"
import { Role } from "@/src/lib/rbac/roles"

export type InvoiceFilters = {
  organizationId?: string
  propertyId?: string
  status?: WeeklyAttendanceInvoiceStatus
  type?: WeeklyAttendanceInvoiceType
  from?: Date
  to?: Date
  search?: string
}

const invoiceListInclude = {
  organization: { select: { id: true, name: true } },
  property: { select: { id: true, organizationId: true, name: true } },
  staffingCompany: { select: { id: true, displayName: true } },
  batch: { select: { id: true, status: true } },
} satisfies Prisma.WeeklyAttendanceInvoiceInclude

export async function listInvoices(user: CurrentUser, filters: InvoiceFilters) {
  const scope = invoiceScope(user)
  const where = invoiceWhere(scope, filters)
  const [invoices, organizations, properties, totals] = await Promise.all([
    prisma.weeklyAttendanceInvoice.findMany({
      where,
      include: invoiceListInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.organization.findMany({
      where: {
        status: RecordStatus.ACTIVE,
        weeklyAttendanceInvoices: { some: scope },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.property.findMany({
      where: {
        status: RecordStatus.ACTIVE,
        weeklyAttendanceInvoices: { some: scope },
      },
      select: { id: true, organizationId: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.weeklyAttendanceInvoice.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
  ])

  const now = new Date()
  const overdue = await prisma.weeklyAttendanceInvoice.aggregate({
    where: {
      ...where,
      status: WeeklyAttendanceInvoiceStatus.SENT,
      dueAt: { lt: now },
    },
    _sum: { totalAmount: true },
  })

  return {
    invoices,
    options: { organizations, properties },
    summary: {
      totalInvoices: totals.reduce((sum, row) => sum + row._count._all, 0),
      draftAmount: amountFor(totals, WeeklyAttendanceInvoiceStatus.DRAFT),
      outstandingAmount: amountFor(totals, WeeklyAttendanceInvoiceStatus.SENT),
      paidAmount: amountFor(totals, WeeklyAttendanceInvoiceStatus.PAID),
      overdueAmount: Number(overdue._sum.totalAmount ?? 0),
    },
  }
}

export async function getInvoiceDetail(id: string, user: CurrentUser) {
  const scope = invoiceScope(user)
  const invoice = await prisma.weeklyAttendanceInvoice.findFirst({
    where: { id, ...scope },
    include: {
      ...invoiceListInclude,
      batch: {
        select: {
          id: true,
          status: true,
          weekStartDate: true,
          weekEndDate: true,
        },
      },
    },
  })
  if (!invoice) throw new AuthorizationError("Invoice not found or access denied.")

  const lines = await prisma.weeklyAttendanceLine.findMany({
    where: {
      batchId: invoice.batchId,
      ...(invoice.type === WeeklyAttendanceInvoiceType.DIRECT
        ? { staffingCompanyId: null }
        : invoice.type === WeeklyAttendanceInvoiceType.STAFFING
          ? { staffingCompanyId: invoice.staffingCompanyId ?? undefined }
          : {}),
    },
    include: {
      employee: {
        select: {
          employeeNumber: true,
          firstName: true,
          lastName: true,
        },
      },
      department: { select: { name: true } },
      staffingCompany: { select: { displayName: true } },
    },
    orderBy: { employee: { lastName: "asc" } },
  })

  return { ...invoice, lines }
}

export async function voidInvoice(id: string, user: CurrentUser) {
  if (user.role !== Role.FINANCE_USER) {
    throw new AuthorizationError("Only finance can void invoices.")
  }
  const invoice = await prisma.weeklyAttendanceInvoice.findUnique({ where: { id } })
  if (!invoice) throw new Error("Invoice not found.")
  if (invoice.status !== WeeklyAttendanceInvoiceStatus.DRAFT) {
    throw new Error("Only draft invoices can be voided.")
  }
  const updated = await prisma.weeklyAttendanceInvoice.update({
    where: { id },
    data: { status: WeeklyAttendanceInvoiceStatus.VOID },
  })
  await createAuditLog({
    action: "VOID_WEEKLY_ATTENDANCE_INVOICE",
    entityType: "WeeklyAttendanceInvoice",
    entityId: updated.id,
    organizationId: updated.organizationId,
    propertyId: updated.propertyId,
  })
  return updated
}

function invoiceScope(user: CurrentUser): Prisma.WeeklyAttendanceInvoiceWhereInput {
  switch (user.role) {
    case Role.FINANCE_USER:
    case Role.READ_ONLY_AUDITOR:
      return {}
    case Role.CORPORATE_ADMIN:
    case Role.ORGANIZATION_OWNER:
      return user.organizationId ? { organizationId: user.organizationId } : {}
    case Role.PROPERTY_MANAGER:
    case Role.REGIONAL_MANAGER:
      return { propertyId: { in: user.propertyIds ?? [] } }
    case Role.STAFFING_COMPANY_ADMIN:
      return user.staffingCompanyId
        ? {
            type: WeeklyAttendanceInvoiceType.STAFFING,
            staffingCompanyId: user.staffingCompanyId,
          }
        : { id: { in: [] } }
    default:
      throw new AuthorizationError("You do not have permission to view invoices.")
  }
}

function invoiceWhere(
  scope: Prisma.WeeklyAttendanceInvoiceWhereInput,
  filters: InvoiceFilters,
): Prisma.WeeklyAttendanceInvoiceWhereInput {
  return {
    AND: [
      scope,
      {
        organizationId: filters.organizationId,
        propertyId: filters.propertyId,
        status: filters.status,
        type: filters.type,
        invoiceNumber: filters.search
          ? { contains: filters.search, mode: "insensitive" }
          : undefined,
        createdAt:
          filters.from || filters.to
            ? {
                gte: filters.from,
                lte: filters.to,
              }
            : undefined,
      },
    ],
  }
}

function amountFor(
  totals: Array<{
    status: WeeklyAttendanceInvoiceStatus
    _sum: { totalAmount: Prisma.Decimal | null }
  }>,
  status: WeeklyAttendanceInvoiceStatus,
) {
  return Number(totals.find((row) => row.status === status)?._sum.totalAmount ?? 0)
}
