import { createHash, randomBytes } from "node:crypto"

import {
  AttendanceAlertType,
  AttendanceCorrectionStatus,
  AttendanceDeviceStatus,
  AttendanceDeviceType,
  AttendanceExceptionStatus,
  AttendanceExceptionType,
  AttendanceFreezeStatus,
  AttendanceRecordStatus,
  EmployeeStatus,
  GeofenceStatus,
  ManagerApprovalStatus,
  Prisma,
  RecordStatus,
  ShiftStatus,
} from "@prisma/client"

import { calculateDistanceMeters } from "@/src/lib/attendance/distance"
import {
  assertOrganizationFeatureAccessById,
} from "@/src/lib/features/organization-feature-access"
import { FeatureKey } from "@/src/lib/features/feature-keys"
import type {
  ApproveDeviceRequest,
  AttendanceCorrectionRequestInput,
  ClockRequest,
  CorrectionActionRequest,
  DeviceRequest,
  ExceptionActionRequest,
  KioskEmployeeVerification,
} from "@/src/lib/attendance/types"
import { prisma } from "@/src/lib/prisma"
import type { CurrentUser } from "@/src/lib/rbac/current-user"
import { AuthorizationError } from "@/src/lib/rbac/errors"
import { Role } from "@/src/lib/rbac/roles"
import { verifyPin } from "@/src/lib/security/pin"

const LATE_GRACE_MINUTES = 5
const HOUR_MS = 60 * 60 * 1000

export class AttendanceCorrectionNotFoundError extends Error {}

function generateSecureCode(bytes = 18) {
  return randomBytes(bytes).toString("base64url")
}

function fingerprintHash(fingerprint: Record<string, unknown>) {
  const normalized = Object.keys(fingerprint)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = fingerprint[key]
      return result
    }, {})

  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex")
}

async function audit(
  action: string,
  entityType: string,
  entityId?: string,
  organizationId?: string,
  propertyId?: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      organizationId,
      propertyId,
      metadata: metadata as Prisma.InputJsonValue | undefined,
    },
  })
}

export async function listDevices(user: CurrentUser) {
  return prisma.attendanceDevice.findMany({
    where: deviceScope(user),
    include: { organization: true, property: true },
    orderBy: { createdAt: "desc" },
  })
}

export async function listDeviceOptions(user: CurrentUser) {
  const organizationWhere = user.organizationId
    ? { id: user.organizationId, status: RecordStatus.ACTIVE }
    : { status: RecordStatus.ACTIVE }
  const propertyWhere = user.propertyIds?.length
    ? { id: { in: user.propertyIds }, status: RecordStatus.ACTIVE }
    : user.organizationId
      ? { organizationId: user.organizationId, status: RecordStatus.ACTIVE }
      : { status: RecordStatus.ACTIVE }

  const [organizations, properties] = await Promise.all([
    prisma.organization.findMany({
      where: organizationWhere,
      orderBy: { name: "asc" },
    }),
    prisma.property.findMany({
      where: propertyWhere,
      orderBy: { name: "asc" },
    }),
  ])

  return { organizations, properties }
}

export async function approveDevice(deviceId: string, input: ApproveDeviceRequest, user: CurrentUser) {
  assertCanAssignDevice(user, input.organizationId, input.propertyId)
  const device = await prisma.attendanceDevice.findUnique({
    where: { id: deviceId },
  })

  if (!device || device.status !== AttendanceDeviceStatus.PENDING) {
    throw new Error("Pending device request was not found.")
  }

  const property = await prisma.property.findFirst({
    where: {
      id: input.propertyId,
      organizationId: input.organizationId,
    },
  })

  if (!property) {
    throw new Error("The selected property does not belong to the organization.")
  }

  const approved = await prisma.attendanceDevice.update({
    where: { id: device.id },
    data: {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      deviceName: input.deviceName,
      deviceType: input.deviceType,
      deviceCode: device.deviceCode ?? `TN-${generateSecureCode(6).toUpperCase()}`,
      deviceFingerprint: device.deviceFingerprint ?? Prisma.JsonNull,
      status: AttendanceDeviceStatus.ACTIVE,
      registeredAt: new Date(),
      lastSeenAt: new Date(),
    },
    include: { organization: true, property: true },
  })

  await audit(
    "ATTENDANCE_DEVICE_APPROVED",
    "AttendanceDevice",
    approved.id,
    approved.organizationId ?? undefined,
    approved.propertyId ?? undefined,
  )

  return approved
}

export async function requestDevice(input: DeviceRequest) {
  const hash = fingerprintHash(input.fingerprint)
  const existing = await prisma.attendanceDevice.findUnique({
    where: { fingerprintHash: hash },
    include: { organization: true, property: true },
  })

  if (existing) {
    if (existing.organizationId) {
      await assertOrganizationFeatureAccessById(existing.organizationId, FeatureKey.KIOSK)
    }
    return prisma.attendanceDevice.update({
      where: { id: existing.id },
      data: {
        deviceFingerprint: input.fingerprint as Prisma.InputJsonValue,
        lastSeenAt: new Date(),
      },
      include: { organization: true, property: true },
    })
  }

  const platform =
    typeof input.fingerprint.platform === "string"
      ? input.fingerprint.platform
      : "Browser"
  const pending = await prisma.attendanceDevice.create({
    data: {
      deviceName: `${platform} attendance kiosk`,
      deviceType: AttendanceDeviceType.KIOSK,
      deviceFingerprint: input.fingerprint as Prisma.InputJsonValue,
      fingerprintHash: hash,
      status: AttendanceDeviceStatus.PENDING,
      lastSeenAt: new Date(),
    },
    include: { organization: true, property: true },
  })

  await audit(
    "ATTENDANCE_DEVICE_REQUESTED",
    "AttendanceDevice",
    pending.id,
    undefined,
    undefined,
    { fingerprintHash: hash },
  )

  return pending
}

export async function rejectDevice(deviceId: string, user: CurrentUser) {
  const device = await prisma.attendanceDevice.findUnique({
    where: { id: deviceId },
  })

  if (!device || device.status !== AttendanceDeviceStatus.PENDING) {
    throw new Error("Pending device request was not found.")
  }
  assertDeviceScope(user, device)

  const rejected = await prisma.attendanceDevice.update({
    where: { id: device.id },
    data: { status: AttendanceDeviceStatus.REJECTED },
    include: { organization: true, property: true },
  })

  await audit("ATTENDANCE_DEVICE_REJECTED", "AttendanceDevice", rejected.id)

  return rejected
}

export async function deactivateDevice(deviceId: string, user: CurrentUser) {
  const device = await prisma.attendanceDevice.findUnique({
    where: { id: deviceId },
  })

  if (!device || device.status !== AttendanceDeviceStatus.ACTIVE) {
    throw new Error("Active device was not found.")
  }
  assertDeviceScope(user, device)

  const deactivated = await prisma.attendanceDevice.update({
    where: { id: device.id },
    data: { status: AttendanceDeviceStatus.SUSPENDED },
    include: { organization: true, property: true },
  })

  await audit(
    "ATTENDANCE_DEVICE_DEACTIVATED",
    "AttendanceDevice",
    deactivated.id,
    deactivated.organizationId ?? undefined,
    deactivated.propertyId ?? undefined,
  )

  return deactivated
}

function deviceScope(user: CurrentUser): Prisma.AttendanceDeviceWhereInput | undefined {
  if (user.role === Role.PLATFORM_OWNER || user.role === Role.PLATFORM_ADMIN) return undefined
  if (user.role === Role.PROPERTY_MANAGER) {
    return { propertyId: { in: user.propertyIds ?? [] } }
  }
  if (user.organizationId) {
    return {
      OR: [
        { organizationId: user.organizationId },
        { organizationId: null, status: AttendanceDeviceStatus.PENDING },
      ],
    }
  }
  throw new AuthorizationError("You do not have permission to view devices.")
}

function assertCanAssignDevice(user: CurrentUser, organizationId: string, propertyId: string) {
  if (user.role === Role.PLATFORM_OWNER || user.role === Role.PLATFORM_ADMIN) return
  if (user.organizationId !== organizationId) {
    throw new AuthorizationError("You cannot assign a device outside your organization.")
  }
  if (user.propertyIds?.length && !user.propertyIds.includes(propertyId)) {
    throw new AuthorizationError("You cannot assign a device outside your properties.")
  }
}

function assertDeviceScope(
  user: CurrentUser,
  device: { organizationId: string | null; propertyId: string | null },
) {
  if (user.role === Role.PLATFORM_OWNER || user.role === Role.PLATFORM_ADMIN) return
  if (!device.organizationId && user.organizationId) return
  if (user.organizationId !== device.organizationId) {
    throw new AuthorizationError("You cannot manage a device outside your organization.")
  }
  if (user.propertyIds?.length && (!device.propertyId || !user.propertyIds.includes(device.propertyId))) {
    throw new AuthorizationError("You cannot manage a device outside your properties.")
  }
}

async function getKioskContext(input: ClockRequest) {
  const device = await prisma.attendanceDevice.findUnique({
    where: { deviceCode: input.deviceCode },
    include: {
      property: { include: { geofences: true } },
    },
  })

  if (
    !device ||
    device.status !== AttendanceDeviceStatus.ACTIVE ||
    !device.organizationId ||
    !device.propertyId ||
    !device.deviceCode ||
    !device.property
  ) {
    await audit("CLOCK_ATTEMPT_BLOCKED", "AttendanceDevice", device?.id, device?.organizationId ?? undefined, device?.propertyId ?? undefined, {
      reason: AttendanceExceptionType.DEVICE_NOT_REGISTERED,
    })
    throw new Error("This device is not registered or active.")
  }

  const activeDevice = {
    ...device,
    organizationId: device.organizationId,
    propertyId: device.propertyId,
    deviceCode: device.deviceCode,
    property: device.property,
  }

  await assertOrganizationFeatureAccessById(activeDevice.organizationId, FeatureKey.KIOSK)

  await prisma.attendanceDevice.update({
    where: { id: activeDevice.id },
    data: { lastSeenAt: new Date() },
  })

  const employee = await validateKioskEmployee(activeDevice, input)

  return { device: activeDevice, employee }
}

export async function verifyKioskEmployee(input: KioskEmployeeVerification) {
  const device = await prisma.attendanceDevice.findUnique({
    where: { deviceCode: input.deviceCode },
    include: { property: true },
  })
  if (
    !device ||
    device.status !== AttendanceDeviceStatus.ACTIVE ||
    !device.organizationId ||
    !device.propertyId ||
    !device.property
  ) {
    throw new Error("This device is not registered or active.")
  }

  await assertOrganizationFeatureAccessById(device.organizationId, FeatureKey.KIOSK)

  const employee = await validateKioskEmployee(
    { organizationId: device.organizationId, propertyId: device.propertyId },
    input,
  )
  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(startOfDay)
  endOfDay.setDate(endOfDay.getDate() + 1)
  const [shift, openRecord] = await Promise.all([
    prisma.shift.findFirst({
      where: {
        employeeId: employee.id,
        propertyId: device.propertyId,
        startTime: { gte: startOfDay, lt: endOfDay },
      },
      select: { id: true, position: true, startTime: true, endTime: true, status: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.attendanceRecord.findFirst({
      where: {
        employeeId: employee.id,
        propertyId: device.propertyId,
        status: {
          in: [
            AttendanceRecordStatus.OPEN,
            AttendanceRecordStatus.PENDING_MANAGER_APPROVAL,
          ],
        },
      },
      select: { id: true, clockInAt: true, status: true },
      orderBy: { clockInAt: "desc" },
    }),
  ])

  await prisma.attendanceDevice.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date() },
  })

  return {
    employee: {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      position: employee.position,
    },
    shift,
    openRecord,
  }
}

export async function createAttendanceCorrectionRequest(
  input: AttendanceCorrectionRequestInput,
) {
  const device = await prisma.attendanceDevice.findUnique({
    where: { deviceCode: input.deviceCode },
    include: { property: true },
  })
  if (
    !device ||
    device.status !== AttendanceDeviceStatus.ACTIVE ||
    !device.organizationId ||
    !device.propertyId ||
    !device.property
  ) {
    throw new Error("This device is not registered or active.")
  }
  await assertOrganizationFeatureAccessById(device.organizationId, FeatureKey.KIOSK)
  const employee = await validateKioskEmployee(
    { organizationId: device.organizationId, propertyId: device.propertyId },
    input,
  )

  let attendanceRecordId = input.attendanceRecordId
  if (attendanceRecordId) {
    const record = await prisma.attendanceRecord.findFirst({
      where: {
        id: attendanceRecordId,
        employeeId: employee.id,
        propertyId: device.propertyId,
      },
      select: { id: true },
    })
    if (!record) throw new Error("Attendance record not found.")
  } else {
    attendanceRecordId = (
      await prisma.attendanceRecord.findFirst({
        where: { employeeId: employee.id, propertyId: device.propertyId },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      })
    )?.id
  }

  const correction = await prisma.attendanceCorrectionRequest.create({
    data: {
      organizationId: device.organizationId,
      propertyId: device.propertyId,
      employeeId: employee.id,
      attendanceRecordId,
      correctionType: input.correctionType,
      requestedClockInAt: input.requestedClockInAt
        ? new Date(input.requestedClockInAt)
        : undefined,
      requestedClockOutAt: input.requestedClockOutAt
        ? new Date(input.requestedClockOutAt)
        : undefined,
      reason: input.reason,
    },
  })

  await audit(
    "ATTENDANCE_CORRECTION_REQUESTED",
    "AttendanceCorrectionRequest",
    correction.id,
    correction.organizationId,
    correction.propertyId,
  )
  return correction
}

async function validateKioskEmployee(
  device: {
    organizationId: string
    propertyId: string
  },
  input: KioskEmployeeVerification,
) {
  const employees = await prisma.employee.findMany({
    where: {
      organizationId: device.organizationId,
      propertyId: device.propertyId,
      employeeNumber: input.employeeNumber || undefined,
      status: EmployeeStatus.ACTIVE,
      clockPinHash: { not: null },
    },
  })
  const matchResults = await Promise.all(
    employees.map(async (employee) => ({
      employee,
      matches: await verifyPin(input.pin, employee.clockPinHash!),
    })),
  )
  const matches = matchResults
    .filter((result) => result.matches)
    .map((result) => result.employee)

  if (matches.length === 0) {
    await audit("CLOCK_ATTEMPT_BLOCKED", "AttendanceDevice", undefined, device.organizationId, device.propertyId, {
      reason: "INVALID_PIN",
    })
    throw new Error("Invalid PIN.")
  }
  if (matches.length > 1) {
    await audit("CLOCK_ATTEMPT_BLOCKED", "AttendanceDevice", undefined, device.organizationId, device.propertyId, {
      reason: "PIN_CONFLICT",
    })
    throw new Error("PIN conflict. Contact manager.")
  }
  return matches[0]
}

export async function clockIn(input: ClockRequest) {
  const now = new Date()
  const { device, employee } = await getKioskContext(input)

  const freeze = await prisma.attendanceFreeze.findFirst({
    where: {
      employeeId: employee.id,
      status: AttendanceFreezeStatus.ACTIVE,
    },
  })

  if (freeze) {
    await audit("CLOCK_IN_BLOCKED", "Employee", employee.id, device.organizationId, device.propertyId, {
      reason: "ACTIVE_ATTENDANCE_FREEZE",
    })
    throw new Error(
      "Clock-in blocked. Manager approval required due to previous unresolved attendance issue.",
    )
  }

  const existingOpenRecord = await prisma.attendanceRecord.findFirst({
    where: {
      employeeId: employee.id,
      status: {
        in: [
          AttendanceRecordStatus.OPEN,
          AttendanceRecordStatus.PENDING_MANAGER_APPROVAL,
        ],
      },
    },
  })

  if (existingOpenRecord) {
    throw new Error("An active attendance record already exists.")
  }

  const shift = await prisma.shift.findFirst({
    where: {
      employeeId: employee.id,
      propertyId: device.propertyId,
      startTime: { lte: now },
      endTime: { gte: now },
      status: { in: [ShiftStatus.PUBLISHED, ShiftStatus.ACCEPTED] },
    },
    orderBy: { startTime: "asc" },
  })

  const geofence = device.property.geofences.find(
    (item) => item.status === GeofenceStatus.ACTIVE,
  )
  const distance =
    geofence && input.location
      ? calculateDistanceMeters(input.location, geofence)
      : undefined

  let exceptionType: AttendanceExceptionType | undefined
  let reason: string | undefined

  if (employee.propertyId && employee.propertyId !== device.propertyId) {
    exceptionType = AttendanceExceptionType.WRONG_PROPERTY
    reason = "Employee attempted to clock in at a different property."
  } else if (geofence && (!input.location || distance! > geofence.radiusMeters)) {
    exceptionType = AttendanceExceptionType.OUTSIDE_GEOFENCE
    reason = "Clock-in location is outside the approved property geofence."
  } else if (!shift) {
    exceptionType = AttendanceExceptionType.UNSCHEDULED_CLOCK_IN
    reason = "No active scheduled shift was found."
  } else if (
    now.getTime() >
    shift.startTime.getTime() + LATE_GRACE_MINUTES * 60 * 1000
  ) {
    exceptionType = AttendanceExceptionType.LATE_CLOCK_IN
    reason = "Clock-in occurred after the five-minute grace period."
  }

  const pending = Boolean(exceptionType)
  const record = await prisma.attendanceRecord.create({
    data: {
      organizationId: device.organizationId,
      propertyId: device.propertyId,
      departmentId: employee.departmentId,
      employeeId: employee.id,
      shiftId: shift?.id,
      deviceId: device.id,
      clockInAt: now,
      clockInPhotoUrl: input.photoUrl,
      clockInLatitude: input.location?.latitude,
      clockInLongitude: input.location?.longitude,
      clockInDistanceMeters: distance,
      status: pending
        ? AttendanceRecordStatus.PENDING_MANAGER_APPROVAL
        : AttendanceRecordStatus.OPEN,
      exceptionType,
      managerApprovalStatus: pending
        ? ManagerApprovalStatus.PENDING
        : ManagerApprovalStatus.NOT_REQUIRED,
    },
  })

  if (exceptionType && reason) {
    await prisma.attendanceException.create({
      data: {
        attendanceRecordId: record.id,
        organizationId: record.organizationId,
        propertyId: record.propertyId,
        employeeId: record.employeeId,
        shiftId: record.shiftId,
        exceptionType,
        reason,
      },
    })
  }

  if (exceptionType === AttendanceExceptionType.LATE_CLOCK_IN) {
    await prisma.attendanceAlert.create({
      data: {
        organizationId: record.organizationId,
        propertyId: record.propertyId,
        employeeId: record.employeeId,
        attendanceRecordId: record.id,
        alertType: AttendanceAlertType.LATE_CLOCK_IN_BLOCKED,
        recipientRole: "PROPERTY_MANAGER",
        message: "Late clock-in requires manager approval.",
      },
    })
  }

  if (exceptionType === AttendanceExceptionType.UNSCHEDULED_CLOCK_IN) {
    await audit(
      "UNSCHEDULED_CLOCK_IN_RECORDED",
      "AttendanceRecord",
      record.id,
      record.organizationId,
      record.propertyId,
      { managerApprovalStatus: ManagerApprovalStatus.PENDING },
    )
  }

  await audit("CLOCK_IN_ATTEMPT", "AttendanceRecord", record.id, record.organizationId, record.propertyId, {
    exceptionType: exceptionType ?? AttendanceExceptionType.NONE,
    pendingManagerApproval: pending,
  })

  return {
    record,
    message:
      exceptionType === AttendanceExceptionType.UNSCHEDULED_CLOCK_IN
        ? "No scheduled shift found. Your clock-in has been recorded and flagged for manager review."
        : pending
          ? "Clock-in request submitted for manager approval."
          : "Clock-in successful.",
  }
}

export async function clockOut(input: ClockRequest) {
  const now = new Date()
  const { device, employee } = await getKioskContext(input)
  const record = await prisma.attendanceRecord.findFirst({
    where: {
      employeeId: employee.id,
      status: {
        in: [
          AttendanceRecordStatus.OPEN,
          AttendanceRecordStatus.PENDING_MANAGER_APPROVAL,
        ],
      },
    },
    orderBy: { clockInAt: "desc" },
  })

  if (!record) {
    throw new Error("No active clock-in record found.")
  }

  const geofence = device.property.geofences.find(
    (item) => item.status === GeofenceStatus.ACTIVE,
  )
  const distance =
    geofence && input.location
      ? calculateDistanceMeters(input.location, geofence)
      : undefined

  const updated = await prisma.attendanceRecord.update({
    where: { id: record.id },
    data: {
      clockOutAt: now,
      clockOutPhotoUrl: input.photoUrl,
      clockOutLatitude: input.location?.latitude,
      clockOutLongitude: input.location?.longitude,
      clockOutDistanceMeters: distance,
      status:
        record.managerApprovalStatus === ManagerApprovalStatus.PENDING
          ? AttendanceRecordStatus.PENDING_MANAGER_APPROVAL
          : AttendanceRecordStatus.CLOCKED_OUT,
    },
  })

  await audit("CLOCK_OUT", "AttendanceRecord", record.id, record.organizationId, record.propertyId)

  return { record: updated, message: "Clock-out successful." }
}

async function createAlertOnce(input: {
  organizationId: string
  propertyId: string
  employeeId?: string
  attendanceRecordId?: string
  alertType: AttendanceAlertType
  recipientRole: string
  message: string
}) {
  const exists = await prisma.attendanceAlert.findFirst({
    where: {
      attendanceRecordId: input.attendanceRecordId,
      employeeId: input.employeeId,
      alertType: input.alertType,
      recipientRole: input.recipientRole,
    },
  })

  if (!exists) {
    await prisma.attendanceAlert.create({ data: input })
  }
}

export async function checkScheduledNoShows() {
  const cutoff = new Date(Date.now() - LATE_GRACE_MINUTES * 60 * 1000)
  const shifts = await prisma.shift.findMany({
    where: {
      employeeId: { not: null },
      startTime: { lte: cutoff },
      status: { in: [ShiftStatus.PUBLISHED, ShiftStatus.ACCEPTED] },
      attendanceRecords: { none: {} },
    },
  })

  for (const shift of shifts) {
    await prisma.shift.update({
      where: { id: shift.id },
      data: { status: ShiftStatus.MISSED },
    })
    await createAlertOnce({
      organizationId: shift.organizationId,
      propertyId: shift.propertyId,
      employeeId: shift.employeeId!,
      alertType: AttendanceAlertType.SCHEDULED_EMPLOYEE_NOT_CLOCKED_IN,
      recipientRole: "PROPERTY_MANAGER",
      message: "A scheduled employee has not clocked in.",
    })
    await createAlertOnce({
      organizationId: shift.organizationId,
      propertyId: shift.propertyId,
      employeeId: shift.employeeId!,
      alertType: AttendanceAlertType.SCHEDULED_EMPLOYEE_NOT_CLOCKED_IN,
      recipientRole: "EMPLOYEE",
      message: "You have not clocked in for your scheduled shift.",
    })
  }

  return { checked: shifts.length }
}

export async function checkMissedClockOuts() {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      status: AttendanceRecordStatus.OPEN,
      clockInAt: { not: null },
    },
  })

  for (const record of records) {
    const hours = (Date.now() - record.clockInAt!.getTime()) / HOUR_MS

    if (hours >= 8) {
      for (const recipientRole of ["PROPERTY_MANAGER", "EMPLOYEE"]) {
        await createAlertOnce({
          organizationId: record.organizationId,
          propertyId: record.propertyId,
          employeeId: record.employeeId,
          attendanceRecordId: record.id,
          alertType: AttendanceAlertType.MISSED_CLOCK_OUT_WARNING_8H,
          recipientRole,
          message: "Attendance record has remained open for eight hours.",
        })
      }
    }

    if (hours >= 9) {
      for (const recipientRole of ["PROPERTY_MANAGER", "EMPLOYEE"]) {
        await createAlertOnce({
          organizationId: record.organizationId,
          propertyId: record.propertyId,
          employeeId: record.employeeId,
          attendanceRecordId: record.id,
          alertType: AttendanceAlertType.MISSED_CLOCK_OUT_WARNING_9H,
          recipientRole,
          message: "Attendance record has remained open for nine hours.",
        })
      }
    }

    if (hours >= 10) {
      await prisma.attendanceRecord.update({
        where: { id: record.id },
        data: {
          clockOutAt: new Date(record.clockInAt!.getTime() + 10 * HOUR_MS),
          status: AttendanceRecordStatus.AUTO_CLOCKED_OUT,
          exceptionType: AttendanceExceptionType.AUTO_CLOCK_OUT,
          managerApprovalStatus: ManagerApprovalStatus.PENDING,
        },
      })
      await prisma.attendanceFreeze.upsert({
        where: { attendanceRecordId: record.id },
        create: {
          organizationId: record.organizationId,
          propertyId: record.propertyId,
          employeeId: record.employeeId,
          attendanceRecordId: record.id,
          reason: "Employee was automatically clocked out after ten hours.",
        },
        update: {
          status: AttendanceFreezeStatus.ACTIVE,
          releasedAt: null,
          releasedByUserId: null,
        },
      })
      await createAlertOnce({
        organizationId: record.organizationId,
        propertyId: record.propertyId,
        employeeId: record.employeeId,
        attendanceRecordId: record.id,
        alertType: AttendanceAlertType.AUTO_CLOCK_OUT_10H,
        recipientRole: "PROPERTY_MANAGER",
        message: "Employee was automatically clocked out after ten hours.",
      })
      await createAlertOnce({
        organizationId: record.organizationId,
        propertyId: record.propertyId,
        employeeId: record.employeeId,
        attendanceRecordId: record.id,
        alertType: AttendanceAlertType.EMPLOYEE_FROZEN,
        recipientRole: "EMPLOYEE",
        message: "Clock-in is frozen until a manager reviews the missed clock-out.",
      })
    }
  }

  return { checked: records.length }
}

export async function getAttendanceAdminData() {
  const employeeSelect = {
    firstName: true,
    lastName: true,
    employeeNumber: true,
  } satisfies Prisma.EmployeeSelect

  const [recentRecords, exceptions, freezes, alerts, correctionRequests] = await Promise.all([
    prisma.attendanceRecord.findMany({
      include: {
        employee: { select: employeeSelect },
        property: { select: { name: true } },
        department: { select: { name: true } },
        device: { select: { deviceName: true, deviceCode: true } },
      },
      orderBy: [
        { clockInAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: 100,
    }),
    prisma.attendanceException.findMany({
      where: { status: AttendanceExceptionStatus.PENDING },
      include: { employee: { select: employeeSelect }, property: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.attendanceFreeze.findMany({
      where: { status: AttendanceFreezeStatus.ACTIVE },
      include: { employee: { select: employeeSelect }, property: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.attendanceAlert.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.attendanceCorrectionRequest.findMany({
      where: { status: AttendanceCorrectionStatus.PENDING },
      include: { employee: { select: employeeSelect }, property: true },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return { openRecords: recentRecords, exceptions, freezes, alerts, correctionRequests }
}

export async function resolveException(input: ExceptionActionRequest) {
  const exception = await prisma.attendanceException.update({
    where: { id: input.exceptionId },
    data: {
      status: input.status,
      approvedByUserId: input.userId,
      approvedAt: new Date(),
    },
  })

  if (exception.attendanceRecordId) {
    const attendanceRecord = await prisma.attendanceRecord.findUnique({
      where: { id: exception.attendanceRecordId },
      select: { clockOutAt: true },
    })
    await prisma.attendanceRecord.update({
      where: { id: exception.attendanceRecordId },
      data: {
        status:
          input.status === AttendanceExceptionStatus.APPROVED
            ? attendanceRecord?.clockOutAt
              ? AttendanceRecordStatus.CLOCKED_OUT
              : AttendanceRecordStatus.OPEN
            : AttendanceRecordStatus.REJECTED,
        managerApprovalStatus:
          input.status === AttendanceExceptionStatus.APPROVED
            ? ManagerApprovalStatus.APPROVED
            : ManagerApprovalStatus.REJECTED,
        notes: input.note,
      },
    })
  }

  await audit(
    `ATTENDANCE_EXCEPTION_${input.status}`,
    "AttendanceException",
    exception.id,
    exception.organizationId,
    exception.propertyId,
    { note: input.note },
  )

  if (exception.exceptionType === AttendanceExceptionType.UNSCHEDULED_CLOCK_IN) {
    await audit(
      input.status === AttendanceExceptionStatus.APPROVED
        ? "UNSCHEDULED_CLOCK_IN_APPROVED"
        : "UNSCHEDULED_CLOCK_IN_REJECTED",
      "AttendanceRecord",
      exception.attendanceRecordId ?? exception.id,
      exception.organizationId,
      exception.propertyId,
      { note: input.note, exceptionId: exception.id },
    )
  }

  return exception
}

export async function resolveAttendanceCorrection(input: CorrectionActionRequest) {
  const correction = await prisma.attendanceCorrectionRequest.findUnique({
    where: { id: input.correctionId },
  })

  if (!correction) {
    throw new AttendanceCorrectionNotFoundError("Attendance correction request not found.")
  }

  if (correction.status !== AttendanceCorrectionStatus.PENDING) {
    throw new Error("Attendance correction request has already been resolved.")
  }

  if (
    input.status === AttendanceCorrectionStatus.APPROVED &&
    correction.attendanceRecordId
  ) {
    const record = await prisma.attendanceRecord.findUnique({
      where: { id: correction.attendanceRecordId },
    })

    if (record) {
      const clockInAt = correction.requestedClockInAt ?? record.clockInAt
      const clockOutAt = correction.requestedClockOutAt ?? record.clockOutAt

      await prisma.attendanceRecord.update({
        where: { id: record.id },
        data: {
          clockInAt,
          clockOutAt,
          status:
            record.managerApprovalStatus === ManagerApprovalStatus.PENDING
              ? AttendanceRecordStatus.PENDING_MANAGER_APPROVAL
              : clockOutAt
                ? AttendanceRecordStatus.CLOCKED_OUT
                : clockInAt
                  ? AttendanceRecordStatus.OPEN
                  : record.status,
        },
      })
    }
  }

  const resolved = await prisma.attendanceCorrectionRequest.update({
    where: { id: correction.id },
    data: { status: input.status },
  })

  await audit(
    `ATTENDANCE_CORRECTION_${input.status}`,
    "AttendanceCorrectionRequest",
    resolved.id,
    resolved.organizationId,
    resolved.propertyId,
    {
      note: input.note,
      attendanceRecordId: resolved.attendanceRecordId,
    },
  )

  return resolved
}

export async function releaseFreeze(
  freezeId: string,
  note?: string,
  userId?: string,
) {
  const freeze = await prisma.attendanceFreeze.update({
    where: { id: freezeId },
    data: {
      status: AttendanceFreezeStatus.RELEASED,
      releasedAt: new Date(),
      releasedByUserId: userId,
    },
  })

  await audit("ATTENDANCE_FREEZE_RELEASED", "AttendanceFreeze", freeze.id, freeze.organizationId, freeze.propertyId, {
    note,
  })

  return freeze
}
