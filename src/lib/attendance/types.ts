import {
  AttendanceExceptionStatus,
  type AttendanceDeviceType,
} from "@prisma/client"

export type LocationEvidence = {
  latitude: number
  longitude: number
}

export type ClockRequest = {
  deviceCode: string
  employeeNumber: string
  pin: string
  photoUrl?: string
  location?: LocationEvidence
}

export type CreateDeviceRequest = {
  organizationId: string
  propertyId: string
  deviceName: string
  deviceType: AttendanceDeviceType
}

export type ExceptionActionRequest = {
  exceptionId: string
  status:
    | typeof AttendanceExceptionStatus.APPROVED
    | typeof AttendanceExceptionStatus.REJECTED
  note?: string
  userId?: string
}
