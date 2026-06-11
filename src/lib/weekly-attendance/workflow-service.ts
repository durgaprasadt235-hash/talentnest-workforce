import {
  WeeklyAttendanceBatchStatus,
  WeeklyAttendanceInvoiceStatus,
  WeeklyAttendanceInvoiceType,
  WeeklyAttendanceLineApprovalStatus,
} from "@prisma/client"

import { createAuditLog } from "@/src/lib/audit"
import { prisma } from "@/src/lib/prisma"
import type { CurrentUser } from "@/src/lib/rbac/current-user"
import { AuthorizationError } from "@/src/lib/rbac/server-guard"
import { Role } from "@/src/lib/rbac/roles"

const corporateReadyStatuses: WeeklyAttendanceBatchStatus[] = [
  WeeklyAttendanceBatchStatus.APPROVED,
  WeeklyAttendanceBatchStatus.LOCKED,
]

export function assertWeeklyAttendanceGenerationScope(
  user: CurrentUser,
  input: { organizationId: string; propertyId: string },
) {
  if (user.role !== Role.PROPERTY_MANAGER) throw new AuthorizationError("Only property managers can generate a property batch.")
  if (user.organizationId && user.organizationId !== input.organizationId) throw new Error("Unauthorized.")
  assertPropertyScope(user, input.propertyId)
}

export async function assertPropertyManagerBatchScope(id: string, user: CurrentUser) {
  if (user.role !== Role.PROPERTY_MANAGER) throw new AuthorizationError("Only property managers can modify attendance batches.")
  const batch = await getBatch(id)
  assertPropertyScope(user, batch.propertyId)
  if (
    batch.status === WeeklyAttendanceBatchStatus.SENT_TO_CORPORATE ||
    batch.status === WeeklyAttendanceBatchStatus.SENT_TO_FINANCE ||
    batch.status === WeeklyAttendanceBatchStatus.INVOICED ||
    batch.status === WeeklyAttendanceBatchStatus.PAID
  ) {
    throw new Error("Submitted attendance batches cannot be modified by the property manager.")
  }
  return batch
}

export async function sendWeeklyAttendanceToCorporate(id: string, user: CurrentUser) {
  const batch = await getBatch(id)
  if (user.role !== Role.PROPERTY_MANAGER) throw new AuthorizationError("Only property managers can send batches to corporate.")
  assertPropertyScope(user, batch.propertyId)
  if (!corporateReadyStatuses.includes(batch.status)) {
    throw new Error("Only approved or locked batches can be submitted to corporate.")
  }

  const updated = await prisma.weeklyAttendanceBatch.update({
    where: { id },
    data: {
      status:
        batch.status === WeeklyAttendanceBatchStatus.LOCKED
          ? WeeklyAttendanceBatchStatus.LOCKED
          : WeeklyAttendanceBatchStatus.SENT_TO_CORPORATE,
      sentToCorporateAt: new Date(),
    },
  })
  await audit("SEND_WEEKLY_ATTENDANCE_TO_CORPORATE", updated)
  return updated
}

export async function sendWeeklyAttendanceToFinance(id: string, user: CurrentUser) {
  const batch = await getBatch(id)
  if (user.role !== Role.CORPORATE_ADMIN) {
    throw new AuthorizationError("Only corporate admins can send batches to finance.")
  }
  if (user.organizationId && user.organizationId !== batch.organizationId) throw new Error("Unauthorized.")
  if (batch.status !== WeeklyAttendanceBatchStatus.LOCKED) {
    throw new Error("Only locked batches can be sent to finance.")
  }

  const updated = await prisma.weeklyAttendanceBatch.update({
    where: { id },
    data: {
      status: WeeklyAttendanceBatchStatus.SENT_TO_FINANCE,
      sentToFinanceAt: new Date(),
    },
  })
  await audit("SEND_WEEKLY_ATTENDANCE_TO_FINANCE", updated)
  return updated
}

export async function sendManagerReminder(id: string, user: CurrentUser) {
  const batch = await getBatch(id)
  assertCorporate(user, batch.organizationId)
  if (
    batch.status !== WeeklyAttendanceBatchStatus.PENDING_MANAGER_REVIEW &&
    batch.status !== WeeklyAttendanceBatchStatus.CORRECTIONS_REQUIRED
  ) {
    throw new Error("A reminder can only be sent for a batch awaiting manager action.")
  }
  const updated = await prisma.weeklyAttendanceBatch.update({
    where: { id },
    data: { managerReminderAt: new Date() },
  })
  await audit("SEND_WEEKLY_ATTENDANCE_MANAGER_REMINDER", updated)
  return updated
}

export async function returnWeeklyAttendanceToManager(id: string, user: CurrentUser) {
  const batch = await getBatch(id)
  assertCorporate(user, batch.organizationId)
  if (
    batch.status !== WeeklyAttendanceBatchStatus.SENT_TO_CORPORATE &&
    batch.status !== WeeklyAttendanceBatchStatus.APPROVED &&
    batch.status !== WeeklyAttendanceBatchStatus.LOCKED
  ) {
    throw new Error("This batch cannot be returned to the property manager.")
  }
  const updated = await prisma.weeklyAttendanceBatch.update({
    where: { id },
    data: {
      status: WeeklyAttendanceBatchStatus.PENDING_MANAGER_REVIEW,
      sentToCorporateAt: null,
      sentToFinanceAt: null,
      financeReviewedAt: null,
    },
  })
  await audit("RETURN_WEEKLY_ATTENDANCE_TO_MANAGER", updated)
  return updated
}

export async function createWeeklyAttendanceInvoice(
  id: string,
  user: CurrentUser,
) {
  if (user.role !== Role.FINANCE_USER) {
    throw new AuthorizationError("Only finance can create invoices.")
  }
  const batch = await getBatch(id)
  if (batch.status !== WeeklyAttendanceBatchStatus.SENT_TO_FINANCE) {
    throw new Error("Only batches sent to finance can be invoiced.")
  }

  const lines = await prisma.weeklyAttendanceLine.findMany({
    where: { batchId: id, approvalStatus: WeeklyAttendanceLineApprovalStatus.APPROVED },
  })
  if (!lines.length) throw new Error("No approved attendance lines are available for this invoice.")

  const groups = [
    { type: WeeklyAttendanceInvoiceType.PAYROLL, staffingCompanyId: null, lines: lines.filter((line) => !line.staffingCompanyId) },
    ...[...new Set(lines.map((line) => line.staffingCompanyId).filter((value): value is string => Boolean(value)))]
      .map((staffingCompanyId) => ({
        type: WeeklyAttendanceInvoiceType.STAFFING,
        staffingCompanyId,
        lines: lines.filter((line) => line.staffingCompanyId === staffingCompanyId),
      })),
  ].filter((group) => group.lines.length > 0)

  const invoices = await prisma.$transaction(async (tx) => {
    const created = []
    for (const group of groups) {
      const existing = await tx.weeklyAttendanceInvoice.findFirst({
        where: { batchId: id, type: group.type, staffingCompanyId: group.staffingCompanyId },
        include: { staffingCompany: { select: { id: true, displayName: true } } },
      })
      if (existing) {
        created.push(existing)
        continue
      }
      const totalHours = sum(group.lines.map((line) => Number(line.totalHours)))
      created.push(await tx.weeklyAttendanceInvoice.create({
        data: {
          invoiceNumber: invoiceNumber(batch, group.type, group.staffingCompanyId),
          batchId: id,
          organizationId: batch.organizationId,
          propertyId: batch.propertyId,
          staffingCompanyId: group.staffingCompanyId,
          type: group.type,
          status: WeeklyAttendanceInvoiceStatus.DRAFT,
          billingWeekStart: batch.weekStartDate,
          billingWeekEnd: batch.weekEndDate,
          directHours: group.type === WeeklyAttendanceInvoiceType.PAYROLL ? totalHours : 0,
          staffingHours: group.type === WeeklyAttendanceInvoiceType.STAFFING ? totalHours : 0,
          regularHours: sum(group.lines.map((line) => Number(line.regularHours))),
          overtimeHours: sum(group.lines.map((line) => Number(line.overtimeHours))),
          totalHours,
          totalAmount: 0,
        },
        include: { staffingCompany: { select: { id: true, displayName: true } } },
      }))
    }
    await tx.weeklyAttendanceBatch.update({
      where: { id: batch.id },
      data: { status: WeeklyAttendanceBatchStatus.INVOICED },
    })
    return created
  })
  await audit("CREATE_WEEKLY_ATTENDANCE_INVOICES", batch, { invoiceIds: invoices.map((invoice) => invoice.id) })
  return invoices
}

export async function markWeeklyAttendanceInvoiceSent(id: string, user: CurrentUser) {
  if (user.role !== Role.FINANCE_USER) throw new AuthorizationError("Only finance can mark invoices sent.")
  const invoice = await getInvoice(id)
  if (invoice.status !== WeeklyAttendanceInvoiceStatus.DRAFT) {
    throw new Error("Only draft invoices can be marked sent.")
  }
  const updated = await prisma.weeklyAttendanceInvoice.update({
    where: { id },
    data: { status: WeeklyAttendanceInvoiceStatus.SENT, sentAt: new Date(), issuedAt: new Date() },
  })
  await invoiceAudit("MARK_WEEKLY_ATTENDANCE_INVOICE_SENT", updated)
  return updated
}

export async function markInvoiceReviewComplete(id: string, user: CurrentUser) {
  if (user.role !== Role.FINANCE_USER) throw new AuthorizationError("Only finance can complete invoice review.")
  const batch = await getBatch(id)
  if (
    batch.status !== WeeklyAttendanceBatchStatus.SENT_TO_FINANCE &&
    batch.status !== WeeklyAttendanceBatchStatus.INVOICED
  ) {
    throw new Error("Only finance-ready or invoiced batches can complete review.")
  }
  const updated = await prisma.weeklyAttendanceBatch.update({
    where: { id },
    data: { financeReviewedAt: new Date() },
  })
  await audit("COMPLETE_WEEKLY_ATTENDANCE_INVOICE_REVIEW", updated)
  return updated
}

export async function markWeeklyAttendanceInvoicePaid(id: string, user: CurrentUser) {
  if (user.role !== Role.FINANCE_USER) throw new AuthorizationError("Only finance can mark invoices paid.")
  const invoice = await prisma.weeklyAttendanceInvoice.findUnique({ where: { id } })
  if (!invoice) throw new Error("Weekly attendance invoice not found.")
  if (invoice.status === WeeklyAttendanceInvoiceStatus.PAID) throw new Error("Invoice is already paid.")
  if (invoice.status !== WeeklyAttendanceInvoiceStatus.SENT) throw new Error("Only sent invoices can be marked paid.")

  const updated = await prisma.weeklyAttendanceInvoice.update({
    where: { id },
    data: { status: WeeklyAttendanceInvoiceStatus.PAID, paidAt: new Date() },
  })
  await createAuditLog({
    action: "MARK_WEEKLY_ATTENDANCE_INVOICE_PAID",
    entityType: "WeeklyAttendanceInvoice",
    entityId: updated.id,
    organizationId: updated.organizationId,
    propertyId: updated.propertyId,
  })
  const remaining = await prisma.weeklyAttendanceInvoice.count({
    where: {
      batchId: updated.batchId,
      status: { not: WeeklyAttendanceInvoiceStatus.PAID },
    },
  })
  if (remaining === 0) {
    await prisma.weeklyAttendanceBatch.update({
      where: { id: updated.batchId },
      data: { status: WeeklyAttendanceBatchStatus.PAID },
    })
  }
  return updated
}

async function getBatch(id: string) {
  const batch = await prisma.weeklyAttendanceBatch.findUnique({ where: { id } })
  if (!batch) throw new Error("Weekly attendance batch not found.")
  return batch
}

async function getInvoice(id: string) {
  const invoice = await prisma.weeklyAttendanceInvoice.findUnique({ where: { id } })
  if (!invoice) throw new Error("Weekly attendance invoice not found.")
  return invoice
}

function assertCorporate(user: CurrentUser, organizationId: string) {
  if (user.role !== Role.CORPORATE_ADMIN && user.role !== Role.ORGANIZATION_OWNER) {
    throw new AuthorizationError("Only corporate users can perform this action.")
  }
  if (user.organizationId && user.organizationId !== organizationId) throw new Error("Unauthorized.")
}

function assertPropertyScope(user: CurrentUser, propertyId: string) {
  if (!user.propertyIds?.includes(propertyId)) {
    throw new AuthorizationError("This property is not assigned to the current property manager.")
  }
}

function sum(values: number[]) {
  return Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100
}

function invoiceNumber(
  batch: { id: string; weekStartDate: Date },
  type: WeeklyAttendanceInvoiceType,
  staffingCompanyId: string | null,
) {
  const week = batch.weekStartDate.toISOString().slice(0, 10).replaceAll("-", "")
  const suffix = staffingCompanyId ?? "DIRECT"
  return `TN-${week}-${batch.id.slice(-6)}-${type}-${suffix}`.toUpperCase()
}

function invoiceAudit(
  action: string,
  invoice: { id: string; organizationId: string; propertyId: string },
) {
  return createAuditLog({
    action,
    entityType: "WeeklyAttendanceInvoice",
    entityId: invoice.id,
    organizationId: invoice.organizationId,
    propertyId: invoice.propertyId,
  })
}

function audit(action: string, batch: { id: string; organizationId: string; propertyId: string }, metadata?: Record<string, unknown>) {
  return createAuditLog({
    action,
    entityType: "WeeklyAttendanceBatch",
    entityId: batch.id,
    organizationId: batch.organizationId,
    propertyId: batch.propertyId,
    metadata,
  })
}
