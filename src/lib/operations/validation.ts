import { AttendanceDeviceType, RecordStatus, ScheduleStatus, StaffingCompanyStatus } from "@prisma/client"
import { z } from "zod"

const id = z.string().trim().min(1).max(100)
const optionalText = z.string().trim().max(500).nullable().optional()

export const departmentRoleSchema = z.object({
  departmentId: id,
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50),
  isManager: z.boolean().default(false),
  canApproveAttendance: z.boolean().default(false),
  canManageSchedule: z.boolean().default(false),
  status: z.enum(RecordStatus).optional(),
})

export const staffingCompanySchema = z.object({
  organizationId: id,
  legalName: z.string().trim().min(1).max(200),
  displayName: z.string().trim().min(1).max(200),
  contactName: optionalText,
  email: z.email().nullable().optional(),
  phone: optionalText,
  billingEmail: z.email().nullable().optional(),
  status: z.enum(StaffingCompanyStatus).optional(),
})

export const scheduleSchema = z.object({
  organizationId: id,
  propertyId: id,
  weekStartDate: z.iso.date(),
  notes: optionalText,
})

export const scheduleStatusSchema = z.object({
  status: z.enum(ScheduleStatus),
})

export const scheduleShiftSchema = z.object({
  employeeId: id,
  departmentId: id.nullable().optional(),
  departmentRoleId: id.nullable().optional(),
  shiftDate: z.iso.date(),
  startTime: z.iso.datetime(),
  endTime: z.iso.datetime(),
  breakMinutes: z.number().int().min(0).max(480).default(0),
  notes: optionalText,
})

export const registeredDeviceSchema = z.object({
  organizationId: id,
  propertyId: id,
  deviceName: z.string().trim().min(1).max(200),
  deviceType: z.enum(AttendanceDeviceType).default(AttendanceDeviceType.KIOSK),
  fingerprint: z.record(z.string(), z.unknown()),
})
