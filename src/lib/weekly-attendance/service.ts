import {
  AttendanceExceptionStatus,
  AttendanceCorrectionStatus,
  AttendanceRecordStatus,
  ManagerApprovalStatus,
  Prisma,
  RecordStatus,
  WeeklyAttendanceBatchStatus,
  WeeklyAttendanceLineApprovalStatus,
} from "@prisma/client"

import { createAuditLog } from "@/src/lib/audit"
import { prisma } from "@/src/lib/prisma"
import type { Role as BusinessRole } from "@/src/lib/rbac/roles"
import {
  type ApproveWeeklyAttendanceInput,
  type GenerateWeeklyAttendanceInput,
  type RequestWeeklyAttendanceCorrectionsInput,
} from "@/src/lib/weekly-attendance/validation"

const OVERTIME_THRESHOLD_HOURS = 40
const HOUR_MS = 60 * 60 * 1000

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

type WeeklyAttendanceFilters = {
  organizationId?: string
  propertyId?: string
  status?: WeeklyAttendanceBatchStatus
}

export async function listWeeklyAttendance(
  role: BusinessRole,
  filters: WeeklyAttendanceFilters = {},
) {
  const visibleStatuses: WeeklyAttendanceBatchStatus[] | undefined =
    role === "FINANCE_USER"
      ? [
          WeeklyAttendanceBatchStatus.APPROVED,
          WeeklyAttendanceBatchStatus.LOCKED,
        ]
      : undefined

  if (
    filters.status &&
    visibleStatuses &&
    !visibleStatuses.includes(filters.status)
  ) {
    const [organizations, properties] = await Promise.all([
      prisma.organization.findMany({
        where: { status: RecordStatus.ACTIVE },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.property.findMany({
        where: {
          status: RecordStatus.ACTIVE,
          organizationId: filters.organizationId ?? undefined,
        },
        select: { id: true, organizationId: true, name: true },
        orderBy: { name: "asc" },
      }),
    ])

    return { batches: [], options: { organizations, properties } }
  }

  const where: Prisma.WeeklyAttendanceBatchWhereInput = {}
  if (filters.organizationId) where.organizationId = filters.organizationId
  if (filters.propertyId) where.propertyId = filters.propertyId

  if (filters.status) {
    where.status = filters.status
  } else if (visibleStatuses) {
    where.status = { in: visibleStatuses }
  }

  const [batches, organizations, properties] = await Promise.all([
    prisma.weeklyAttendanceBatch.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: [{ weekStartDate: "desc" }, { generatedAt: "desc" }],
    }),
    prisma.organization.findMany({
      where: { status: RecordStatus.ACTIVE },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.property.findMany({
      where: {
        status: RecordStatus.ACTIVE,
        organizationId: filters.organizationId ?? undefined,
      },
      select: { id: true, organizationId: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return { batches, options: { organizations, properties } }
}

export async function getWeeklyAttendanceBatch(
  id: string,
  role: BusinessRole,
) {
  const batch = await prisma.weeklyAttendanceBatch.findUnique({
    where: { id },
    include: batchInclude,
  })

  if (!batch) throw new Error("Weekly attendance batch not found.")
  if (
    role === "FINANCE_USER" &&
    batch.status !== WeeklyAttendanceBatchStatus.APPROVED &&
    batch.status !== WeeklyAttendanceBatchStatus.LOCKED
  ) {
    throw new Error("Weekly attendance batch is not payroll-ready.")
  }

  return batch
}

export async function generateWeeklyAttendance(
  input: GenerateWeeklyAttendanceInput,
) {
  const weekStartDate = parseDate(input.weekStartDate)
  const weekEndDate = addDays(weekStartDate, 6)
  const nextWeekStart = addDays(weekStartDate, 7)

  const existing = await prisma.weeklyAttendanceBatch.findUnique({
    where: {
      propertyId_weekStartDate: {
        propertyId: input.propertyId,
        weekStartDate,
      },
    },
    include: batchInclude,
  })
  if (existing) return existing

  const property = await prisma.property.findFirst({
    where: { id: input.propertyId, organizationId: input.organizationId },
    select: { id: true },
  })
  if (!property) {
    throw new Error("Property does not belong to the selected organization.")
  }

  const records = await prisma.attendanceRecord.findMany({
    where: {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      status: { not: AttendanceRecordStatus.REJECTED },
      OR: [
        { clockInAt: { gte: weekStartDate, lt: nextWeekStart } },
        { clockOutAt: { gte: weekStartDate, lt: nextWeekStart } },
      ],
    },
    include: {
      employee: {
        select: {
          id: true,
          departmentId: true,
          staffingCompanyId: true,
        },
      },
      exceptions: { select: { status: true } },
      correctionRequests: { select: { status: true } },
    },
  })

  const grouped = new Map<string, WeeklyLineCalculation>()
  for (const record of records) {
    const calculation = grouped.get(record.employeeId) ?? {
      employeeId: record.employeeId,
      departmentId: record.departmentId ?? record.employee.departmentId,
      staffingCompanyId: record.employee.staffingCompanyId,
      totalHours: 0,
      missingPunchCount: 0,
      exceptionCount: 0,
      correctionPendingCount: 0,
    }

    calculation.missingPunchCount += Number(!record.clockInAt)
    calculation.missingPunchCount += Number(!record.clockOutAt)
    if (record.clockInAt && record.clockOutAt && record.clockOutAt > record.clockInAt) {
      calculation.totalHours +=
        (record.clockOutAt.getTime() - record.clockInAt.getTime()) / HOUR_MS
    }

    calculation.exceptionCount += record.exceptions.length
    const pendingExceptions = record.exceptions.filter(
      (exception) => exception.status === AttendanceExceptionStatus.PENDING,
    ).length
    calculation.correctionPendingCount += pendingExceptions
    calculation.correctionPendingCount += record.correctionRequests.filter(
      (correction) => correction.status === AttendanceCorrectionStatus.PENDING,
    ).length
    if (
      pendingExceptions === 0 &&
      (record.managerApprovalStatus === ManagerApprovalStatus.PENDING ||
        record.status === AttendanceRecordStatus.FROZEN_PENDING_REVIEW)
    ) {
      calculation.correctionPendingCount += 1
    }

    grouped.set(record.employeeId, calculation)
  }

  const lines = [...grouped.values()].map((line) => {
    const totalHours = roundHours(line.totalHours)
    const regularHours = Math.min(totalHours, OVERTIME_THRESHOLD_HOURS)
    const overtimeHours = Math.max(0, totalHours - OVERTIME_THRESHOLD_HOURS)

    return {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      departmentId: line.departmentId,
      employeeId: line.employeeId,
      staffingCompanyId: line.staffingCompanyId,
      regularHours,
      overtimeHours: roundHours(overtimeHours),
      totalHours,
      missingPunchCount: line.missingPunchCount,
      exceptionCount: line.exceptionCount,
      correctionPendingCount: line.correctionPendingCount,
      approvalStatus:
        line.correctionPendingCount > 0
          ? WeeklyAttendanceLineApprovalStatus.CORRECTION_REQUIRED
          : WeeklyAttendanceLineApprovalStatus.PENDING,
    }
  })

  try {
    const batch = await prisma.weeklyAttendanceBatch.create({
      data: {
        organizationId: input.organizationId,
        propertyId: input.propertyId,
        weekStartDate,
        weekEndDate,
        status: WeeklyAttendanceBatchStatus.PENDING_MANAGER_REVIEW,
        lines: { create: lines },
      },
      include: batchInclude,
    })

    await audit("GENERATE_WEEKLY_ATTENDANCE", batch)
    return batch
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return getExistingBatch(input.propertyId, weekStartDate)
    }
    throw error
  }
}

export async function approveWeeklyAttendance(
  id: string,
  input: ApproveWeeklyAttendanceInput,
) {
  const batch = await getMutableBatch(id)
  const correctionPendingCount = sum(
    batch.lines.map((line) => line.correctionPendingCount),
  )
  const correctionRequired = batch.lines.some(
    (line) =>
      line.approvalStatus ===
      WeeklyAttendanceLineApprovalStatus.CORRECTION_REQUIRED,
  )
  const missingPunchCount = sum(batch.lines.map((line) => line.missingPunchCount))

  if (batch.status === WeeklyAttendanceBatchStatus.APPROVED) {
    throw new Error("Weekly attendance batch is already approved.")
  }
  if (correctionPendingCount > 0 || correctionRequired) {
    throw new Error("Resolve all pending corrections before approving this batch.")
  }
  if (missingPunchCount > 0 && !input.overrideNote?.trim()) {
    throw new Error(
      "A manager override note is required when missing punches remain.",
    )
  }
  if (input.approvedByUserId) {
    const user = await prisma.user.findUnique({
      where: { id: input.approvedByUserId },
      select: { id: true },
    })
    if (!user) throw new Error("Approving user not found.")
  }

  const approved = await prisma.weeklyAttendanceBatch.update({
    where: { id },
    data: {
      status: WeeklyAttendanceBatchStatus.APPROVED,
      approvedAt: new Date(),
      approvedByUserId: input.approvedByUserId,
      lines: {
        updateMany: {
          where: {},
          data: {
            approvalStatus: WeeklyAttendanceLineApprovalStatus.APPROVED,
            managerNote: input.overrideNote,
          },
        },
      },
    },
    include: batchInclude,
  })

  await audit("APPROVE_WEEKLY_ATTENDANCE", approved, {
    overrideNote: input.overrideNote,
  })
  return approved
}

export async function requestWeeklyAttendanceCorrections(
  id: string,
  input: RequestWeeklyAttendanceCorrectionsInput,
) {
  const batch = await getMutableBatch(id)
  if (batch.status === WeeklyAttendanceBatchStatus.APPROVED) {
    throw new Error("Approved batches cannot be returned for corrections.")
  }

  const updated = await prisma.weeklyAttendanceBatch.update({
    where: { id },
    data: {
      status: WeeklyAttendanceBatchStatus.CORRECTIONS_REQUIRED,
      lines: {
        updateMany: {
          where: {
            approvalStatus: {
              not: WeeklyAttendanceLineApprovalStatus.REJECTED,
            },
          },
          data: {
            approvalStatus: WeeklyAttendanceLineApprovalStatus.CORRECTION_REQUIRED,
            managerNote: input.managerNote,
          },
        },
      },
    },
    include: batchInclude,
  })

  await audit("REQUEST_WEEKLY_ATTENDANCE_CORRECTIONS", updated, {
    managerNote: input.managerNote,
  })
  return updated
}

export async function lockWeeklyAttendance(id: string) {
  const batch = await prisma.weeklyAttendanceBatch.findUnique({
    where: { id },
    include: { lines: true },
  })
  if (!batch) throw new Error("Weekly attendance batch not found.")
  if (batch.status !== WeeklyAttendanceBatchStatus.APPROVED) {
    throw new Error("Only approved weekly attendance batches can be locked.")
  }

  const locked = await prisma.weeklyAttendanceBatch.update({
    where: { id },
    data: { status: WeeklyAttendanceBatchStatus.LOCKED },
    include: batchInclude,
  })
  await audit("LOCK_WEEKLY_ATTENDANCE", locked)
  return locked
}

async function getMutableBatch(id: string) {
  const batch = await prisma.weeklyAttendanceBatch.findUnique({
    where: { id },
    include: { lines: true },
  })
  if (!batch) throw new Error("Weekly attendance batch not found.")
  if (batch.status === WeeklyAttendanceBatchStatus.LOCKED) {
    throw new Error("Locked weekly attendance batches cannot be modified.")
  }
  return batch
}

function getExistingBatch(propertyId: string, weekStartDate: Date) {
  return prisma.weeklyAttendanceBatch.findUniqueOrThrow({
    where: { propertyId_weekStartDate: { propertyId, weekStartDate } },
    include: batchInclude,
  })
}

function audit(
  action: string,
  batch: { id: string; organizationId: string; propertyId: string },
  metadata?: Record<string, unknown>,
) {
  return createAuditLog({
    action,
    entityType: "WeeklyAttendanceBatch",
    entityId: batch.id,
    organizationId: batch.organizationId,
    propertyId: batch.propertyId,
    metadata,
  })
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function roundHours(hours: number) {
  return Math.round(hours * 100) / 100
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

type WeeklyLineCalculation = {
  employeeId: string
  departmentId: string | null
  staffingCompanyId: string | null
  totalHours: number
  missingPunchCount: number
  exceptionCount: number
  correctionPendingCount: number
}
