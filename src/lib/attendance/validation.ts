import {
  AttendanceCorrectionStatus,
  AttendanceDeviceType,
  AttendanceExceptionStatus,
} from "@prisma/client"
import { z } from "zod"

const trimmedString = z.string().trim().min(1)

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

const fingerprintSchema = z.record(z.string(), z.unknown())

export const clockRequestSchema = z.object({
  deviceCode: trimmedString.max(100).optional(),
  fingerprint: fingerprintSchema.optional(),
  employeeId: trimmedString.max(100).optional(),
  propertyId: trimmedString.max(100).optional(),
  pin: z.string().regex(/^\d{4}$/),
  photoUrl: z.string().min(1).max(2_000_000),
  location: locationSchema.optional(),
}).refine((input) => Boolean(input.deviceCode || input.fingerprint), {
  message: "Device context is required.",
})

export const approveDeviceRequestSchema = z.object({
  organizationId: trimmedString.max(100),
  propertyId: trimmedString.max(100),
  deviceName: trimmedString.max(200),
  deviceType: z.enum(AttendanceDeviceType),
})

export const deviceRequestSchema = z.object({
  fingerprint: fingerprintSchema,
})

export const kioskEmployeeVerificationSchema = z.object({
  deviceCode: trimmedString.max(100),
  pin: z.string().regex(/^\d{4}$/),
})

export const kioskSessionSchema = z.object({
  fingerprint: fingerprintSchema,
  pin: z.string().regex(/^\d{4}$/),
})

export const attendanceCorrectionRequestSchema = z.object({
  fingerprint: fingerprintSchema,
  employeeId: trimmedString.max(100),
  propertyId: trimmedString.max(100),
  pin: z.string().regex(/^\d{4}$/),
  attendanceRecordId: trimmedString.max(100).optional(),
  correctionType: z.enum([
    "MISSED_CLOCK_IN",
    "MISSED_CLOCK_OUT",
    "WRONG_CLOCK_IN_TIME",
    "WRONG_CLOCK_OUT_TIME",
    "DUPLICATE_PUNCH",
  ]),
  requestedDate: z.iso.date(),
  requestedTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  requestedClockInAt: z.iso.datetime().optional(),
  requestedClockOutAt: z.iso.datetime().optional(),
})

export const exceptionActionRequestSchema = z.object({
  exceptionId: trimmedString.max(100),
  status: z.enum([
    AttendanceExceptionStatus.APPROVED,
    AttendanceExceptionStatus.REJECTED,
  ]),
  note: z.string().trim().max(2_000).optional(),
  userId: z.string().trim().max(100).optional(),
})

export const freezeReleaseRequestSchema = z.object({
  freezeId: trimmedString.max(100),
  note: z.string().trim().max(2_000).optional(),
  userId: z.string().trim().max(100).optional(),
})

export const correctionActionRequestSchema = z.object({
  correctionId: trimmedString.max(100),
  status: z.enum([
    AttendanceCorrectionStatus.APPROVED,
    AttendanceCorrectionStatus.REJECTED,
  ]),
  note: z.string().trim().max(2_000).optional(),
}).refine(
  (input) => input.status !== AttendanceCorrectionStatus.REJECTED || Boolean(input.note),
  {
    message: "Manager note is required to reject a correction request.",
    path: ["note"],
  },
)

export type ClockRequest = z.infer<typeof clockRequestSchema>
export type ApproveDeviceRequest = z.infer<typeof approveDeviceRequestSchema>
export type DeviceRequest = z.infer<typeof deviceRequestSchema>
export type KioskEmployeeVerification = z.infer<typeof kioskEmployeeVerificationSchema>
export type KioskSessionInput = z.infer<typeof kioskSessionSchema>
export type AttendanceCorrectionRequestInput = z.infer<typeof attendanceCorrectionRequestSchema>
export type CorrectionActionRequest = z.infer<typeof correctionActionRequestSchema>
export type ExceptionActionRequest = z.infer<typeof exceptionActionRequestSchema>
