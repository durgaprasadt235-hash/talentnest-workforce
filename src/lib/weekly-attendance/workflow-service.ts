import {
  WeeklyAttendanceBatchStatus,
  WeeklyAttendanceInvoiceStatus,
  WeeklyAttendanceInvoiceType,
} from "@prisma/client"

import { createAuditLog } from "@/src/lib/audit"
import { prisma } from "@/src/lib/prisma"
import type { CurrentUser } from "@/src/lib/rbac/current-user"
import { Role } from "@/src/lib/rbac/roles"
import { generateWeeklyAttendance } from "@/src/lib/weekly-attendance/service"
import type {
  BatchGenerateWeeklyAttendanceInput,
  CreateWeeklyAttendanceInvoiceInput,
} from "@/src/lib/weekly-attendance/validation"

const readyStatuses: WeeklyAttendanceBatchStatus[] = [
  WeeklyAttendanceBatchStatus.APPROVED,
  WeeklyAttendanceBatchStatus.LOCKED,
]

export async function generateWeeklyAttendanceForProperties(
  user: CurrentUser,
  input: BatchGenerateWeeklyAttendanceInput,
) {
  assertCorporate(user, input.organizationId)
  const properties = await prisma.property.findMany({
    where: { id: { in: input.propertyIds }, organizationId: input.organizationId },
    select: { id: true },
  })
  if (properties.length !== new Set(input.propertyIds).size) {
    throw new Error("One or more selected properties are invalid.")
  }

  const batches = []
  for (const property of properties) {
    batches.push(await generateWeeklyAttendance({
      organizationId: input.organizationId,
      propertyId: property.id,
      weekStartDate: input.weekStartDate,
    }))
  }
  return batches
}

export function assertWeeklyAttendanceGenerationScope(
  user: CurrentUser,
  input: { organizationId: string; propertyId: string },
) {
  if (user.role !== Role.PROPERTY_MANAGER) throw new Error("Only property managers can generate a property batch.")
  if (user.organizationId && user.organizationId !== input.organizationId) throw new Error("Unauthorized.")
  assertPropertyScope(user, input.propertyId)
}

export async function assertPropertyManagerBatchScope(id: string, user: CurrentUser) {
  if (user.role !== Role.PROPERTY_MANAGER) throw new Error("Only property managers can modify attendance batches.")
  const batch = await getBatch(id)
  assertPropertyScope(user, batch.propertyId)
  return batch
}

export async function sendWeeklyAttendanceToCorporate(id: string, user: CurrentUser) {
  const batch = await getBatch(id)
  if (user.role !== Role.PROPERTY_MANAGER) throw new Error("Only property managers can send batches to corporate.")
  assertPropertyScope(user, batch.propertyId)
  assertReady(batch.status)

  const updated = await prisma.weeklyAttendanceBatch.update({
    where: { id },
    data: { sentToCorporateAt: new Date() },
  })
  await audit("SEND_WEEKLY_ATTENDANCE_TO_CORPORATE", updated)
  return updated
}

export async function sendWeeklyAttendanceToFinance(id: string, user: CurrentUser) {
  const batch = await getBatch(id)
  assertCorporate(user, batch.organizationId)
  assertReady(batch.status)
  if (!batch.sentToCorporateAt) throw new Error("The property must send this batch to corporate first.")

  const updated = await prisma.weeklyAttendanceBatch.update({
    where: { id },
    data: { sentToFinanceAt: new Date() },
  })
  await audit("SEND_WEEKLY_ATTENDANCE_TO_FINANCE", updated)
  return updated
}

export async function createWeeklyAttendanceInvoice(
  id: string,
  user: CurrentUser,
  input: CreateWeeklyAttendanceInvoiceInput,
) {
  const batch = await getBatch(id)
  assertReady(batch.status)

  let staffingCompanyId = input.staffingCompanyId
  if (user.role === Role.STAFFING_COMPANY_ADMIN) {
    if (input.type !== WeeklyAttendanceInvoiceType.STAFFING || !user.staffingCompanyId) {
      throw new Error("Staffing company invoice access is not configured.")
    }
    staffingCompanyId = user.staffingCompanyId
  } else if (user.role === Role.FINANCE_USER) {
    if (!batch.sentToFinanceAt) throw new Error("This batch has not been sent to finance.")
  } else {
    throw new Error("You do not have permission to create this invoice.")
  }

  if (input.type === WeeklyAttendanceInvoiceType.STAFFING && !staffingCompanyId) {
    throw new Error("Select a staffing company.")
  }

  const existing = await prisma.weeklyAttendanceInvoice.findFirst({
    where: { batchId: id, type: input.type, staffingCompanyId: staffingCompanyId ?? null },
    include: { staffingCompany: { select: { displayName: true } } },
  })
  if (existing) return existing

  const lines = await prisma.weeklyAttendanceLine.findMany({
    where: {
      batchId: id,
      staffingCompanyId:
        input.type === WeeklyAttendanceInvoiceType.STAFFING
          ? staffingCompanyId
          : null,
    },
  })
  if (!lines.length) throw new Error("No approved attendance lines are available for this invoice.")

  const invoice = await prisma.weeklyAttendanceInvoice.create({
    data: {
      batchId: id,
      organizationId: batch.organizationId,
      propertyId: batch.propertyId,
      staffingCompanyId,
      type: input.type,
      status: WeeklyAttendanceInvoiceStatus.ISSUED,
      issuedAt: new Date(),
      regularHours: sum(lines.map((line) => Number(line.regularHours))),
      overtimeHours: sum(lines.map((line) => Number(line.overtimeHours))),
      totalHours: sum(lines.map((line) => Number(line.totalHours))),
    },
    include: { staffingCompany: { select: { displayName: true } } },
  })
  await audit("CREATE_WEEKLY_ATTENDANCE_INVOICE", batch, { invoiceId: invoice.id, type: invoice.type })
  return invoice
}

export async function markWeeklyAttendanceInvoicePaid(id: string, user: CurrentUser) {
  if (user.role !== Role.FINANCE_USER) throw new Error("Only finance can mark invoices paid.")
  const invoice = await prisma.weeklyAttendanceInvoice.findUnique({ where: { id } })
  if (!invoice) throw new Error("Weekly attendance invoice not found.")
  if (invoice.status === WeeklyAttendanceInvoiceStatus.PAID) throw new Error("Invoice is already paid.")

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
  return updated
}

async function getBatch(id: string) {
  const batch = await prisma.weeklyAttendanceBatch.findUnique({ where: { id } })
  if (!batch) throw new Error("Weekly attendance batch not found.")
  return batch
}

function assertCorporate(user: CurrentUser, organizationId: string) {
  if (user.role !== Role.CORPORATE_ADMIN && user.role !== Role.ORGANIZATION_OWNER) {
    throw new Error("Only corporate users can perform this action.")
  }
  if (user.organizationId && user.organizationId !== organizationId) throw new Error("Unauthorized.")
}

function assertPropertyScope(user: CurrentUser, propertyId: string) {
  if (user.propertyIds?.length && !user.propertyIds.includes(propertyId)) throw new Error("Unauthorized.")
}

function assertReady(status: WeeklyAttendanceBatchStatus) {
  if (!readyStatuses.includes(status)) throw new Error("Only approved or locked batches can continue in the workflow.")
}

function sum(values: number[]) {
  return Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100
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
