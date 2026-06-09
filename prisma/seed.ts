import {
  AttendanceDeviceStatus,
  AttendanceDeviceType,
  EmploymentType,
  GeofenceStatus,
  RecordStatus,
  ShiftStatus,
} from "@prisma/client"

import { prisma } from "../src/lib/prisma"
import { hashPin } from "../src/lib/security/pin"

const seededOrganizationId = "seed-chase-hotel-group"
const propertyId = "seed-best-western-erie"
const departmentId = "seed-front-desk"
const geofenceId = "seed-best-western-erie-geofence"
const deviceId = "seed-best-western-erie-kiosk"

function todayAt(hour: number) {
  const date = new Date()
  date.setHours(hour, 0, 0, 0)
  return date
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

async function main() {
  const pinHash = await hashPin(process.env.SEED_EMPLOYEE_PIN ?? "2468")
  const shiftDate = todayAt(0)
  const todayKey = dateKey(shiftDate)

  const organization = await prisma.organization.upsert({
    where: { slug: "chase-hotel-group" },
    update: { name: "Chase Hotel Group", status: RecordStatus.ACTIVE },
    create: {
      id: seededOrganizationId,
      name: "Chase Hotel Group",
      slug: "chase-hotel-group",
      status: RecordStatus.ACTIVE,
    },
  })
  const organizationId = organization.id

  await prisma.property.upsert({
    where: { id: propertyId },
    update: {
      organizationId,
      name: "Best Western Erie",
      code: "BWE",
      city: "Erie",
      state: "PA",
      timeZone: "America/New_York",
      status: RecordStatus.ACTIVE,
    },
    create: {
      id: propertyId,
      organizationId,
      name: "Best Western Erie",
      code: "BWE",
      city: "Erie",
      state: "PA",
      timeZone: "America/New_York",
      status: RecordStatus.ACTIVE,
    },
  })

  await prisma.department.upsert({
    where: { id: departmentId },
    update: {
      organizationId,
      propertyId,
      name: "Front Desk",
      code: "FD",
      status: RecordStatus.ACTIVE,
    },
    create: {
      id: departmentId,
      organizationId,
      propertyId,
      name: "Front Desk",
      code: "FD",
      status: RecordStatus.ACTIVE,
    },
  })

  await prisma.propertyGeofence.upsert({
    where: { id: geofenceId },
    update: {
      organizationId,
      propertyId,
      latitude: 42.1292,
      longitude: -80.0851,
      radiusMeters: 250,
      status: GeofenceStatus.ACTIVE,
    },
    create: {
      id: geofenceId,
      organizationId,
      propertyId,
      latitude: 42.1292,
      longitude: -80.0851,
      radiusMeters: 250,
      status: GeofenceStatus.ACTIVE,
    },
  })

  await prisma.attendanceDevice.upsert({
    where: { deviceCode: "TN-BWE-KIOSK-01" },
    update: {
      organizationId,
      propertyId,
      deviceName: "Best Western Erie Front Desk Kiosk",
      deviceType: AttendanceDeviceType.KIOSK,
      status: AttendanceDeviceStatus.ACTIVE,
    },
    create: {
      id: deviceId,
      organizationId,
      propertyId,
      deviceName: "Best Western Erie Front Desk Kiosk",
      deviceCode: "TN-BWE-KIOSK-01",
      registrationToken: "seed-best-western-erie-registration",
      deviceType: AttendanceDeviceType.KIOSK,
      status: AttendanceDeviceStatus.ACTIVE,
      registeredAt: new Date(),
    },
  })

  const employees = [
    { employeeNumber: "E1001", firstName: "Avery", lastName: "Morgan" },
    { employeeNumber: "E1002", firstName: "Jordan", lastName: "Lee" },
    { employeeNumber: "E1003", firstName: "Taylor", lastName: "Reed" },
  ]

  for (const employee of employees) {
    const saved = await prisma.employee.upsert({
      where: { employeeNumber: employee.employeeNumber },
      update: {
        organizationId,
        propertyId,
        departmentId,
        firstName: employee.firstName,
        lastName: employee.lastName,
        employmentType: EmploymentType.DIRECT,
        position: "Front Desk Agent",
        status: RecordStatus.ACTIVE,
        clockPinHash: pinHash,
      },
      create: {
        organizationId,
        propertyId,
        departmentId,
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        employmentType: EmploymentType.DIRECT,
        position: "Front Desk Agent",
        status: RecordStatus.ACTIVE,
        clockPinHash: pinHash,
      },
    })

    await prisma.shift.upsert({
      where: { id: `seed-${employee.employeeNumber}-${todayKey}` },
      update: {
        organizationId,
        propertyId,
        departmentId,
        employeeId: saved.id,
        position: "Front Desk Agent",
        shiftDate,
        startTime: todayAt(8),
        endTime: todayAt(16),
        status: ShiftStatus.PUBLISHED,
      },
      create: {
        id: `seed-${employee.employeeNumber}-${todayKey}`,
        organizationId,
        propertyId,
        departmentId,
        employeeId: saved.id,
        position: "Front Desk Agent",
        shiftDate,
        startTime: todayAt(8),
        endTime: todayAt(16),
        status: ShiftStatus.PUBLISHED,
      },
    })
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
