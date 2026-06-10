import { createHash, randomBytes } from "node:crypto"

import {
  AttendanceAlertType,
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
import type {
  ApproveDeviceRequest,
  ClockRequest,
  DeviceRequest,
  ExceptionActionRequest,
} from "@/src/lib/attendance/types"
import { prisma } from "@/src/lib/prisma"
import { verifyPin } from "@/src/lib/security/pin"

const LATE_GRACE_MINUTES = 5
const HOUR_MS = 60 * 60 * 1000

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

export async function listDevices() {
  return prisma.attendanceDevice.findMany({
    include: { organization: true, property: true },
    orderBy: { createdAt: "desc" },
  })
}

export async function listDeviceOptions() {
  const [organizations, properties] = await Promise.all([
    prisma.organization.findMany({
      where: { status: RecordStatus.ACTIVE },
      orderBy: { name: "asc" },
    }),
    prisma.property.findMany({
      where: { status: RecordStatus.ACTIVE },
      orderBy: { name: "asc" },
    }),
  ])

  return { organizations, properties }
}

export async function approveDevice(deviceId: string, input: ApproveDeviceRequest) {
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
      deviceCode: `TN-${generateSecureCode(6).toUpperCase()}`,
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

export async function rejectDevice(deviceId: string) {
  const device = await prisma.attendanceDevice.findUnique({
    where: { id: deviceId },
  })

  if (!device || device.status !== AttendanceDeviceStatus.PENDING) {
    throw new Error("Pending device request was not found.")
  }

  const rejected = await prisma.attendanceDevice.update({
    where: { id: device.id },
    data: { status: AttendanceDeviceStatus.REJECTED },
    include: { organization: true, property: true },
  })

  await audit("ATTENDANCE_DEVICE_REJECTED", "AttendanceDevice", rejected.id)

  return rejected
}

async function getKioskContext(input: ClockRequest, requireActive = false) {
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

  await prisma.attendanceDevice.update({
    where: { id: activeDevice.id },
    data: { lastSeenAt: new Date() },
  })

  const employee = await prisma.employee.findUnique({
    where: { employeeNumber: input.employeeNumber },
  })

  if (!employee || !employee.clockPinHash || !(await verifyPin(input.pin, employee.clockPinHash))) {
    await audit("CLOCK_ATTEMPT_BLOCKED", "Employee", employee?.id, activeDevice.organizationId, activeDevice.propertyId, {
      reason: "INVALID_EMPLOYEE_OR_PIN",
      employeeNumber: input.employeeNumber,
    })
    throw new Error("Employee ID or PIN is invalid.")
  }

  if (requireActive && employee.status !== EmployeeStatus.ACTIVE) {
    await audit("CLOCK_IN_BLOCKED", "Employee", employee.id, activeDevice.organizationId, activeDevice.propertyId, {
      reason: "EMPLOYEE_NOT_ACTIVE",
      status: employee.status,
    })
    throw new Error("Clock-in blocked. Employee is not active.")
  }

  return { device: activeDevice, employee }
}

export async function clockIn(input: ClockRequest) {
  const now = new Date()
  const { device, employee } = await getKioskContext(input, true)

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

  await audit("CLOCK_IN_ATTEMPT", "AttendanceRecord", record.id, record.organizationId, record.propertyId, {
    exceptionType: exceptionType ?? AttendanceExceptionType.NONE,
    pendingManagerApproval: pending,
  })

  return {
    record,
    message: pending
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
      status: AttendanceRecordStatus.OPEN,
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
      status: AttendanceRecordStatus.CLOCKED_OUT,
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

  const [openRecords, exceptions, freezes, alerts] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        status: {
          in: [
            AttendanceRecordStatus.OPEN,
            AttendanceRecordStatus.PENDING_MANAGER_APPROVAL,
          ],
        },
      },
      include: { employee: { select: employeeSelect }, property: true },
      orderBy: { createdAt: "desc" },
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
  ])

  return { openRecords, exceptions, freezes, alerts }
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
    await prisma.attendanceRecord.update({
      where: { id: exception.attendanceRecordId },
      data: {
        status:
          input.status === AttendanceExceptionStatus.APPROVED
            ? AttendanceRecordStatus.OPEN
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

  return exception
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
