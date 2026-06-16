import { RecordStatus } from "@prisma/client"
import { z } from "zod"

import { ROLES } from "@/src/lib/rbac/roles"

const requiredText = z.string().trim().min(1).max(200)
const optionalId = z.string().trim().min(1).nullable().optional()

export const userInputSchema = z.object({
  firstName: requiredText,
  lastName: requiredText,
  email: z.email().trim().toLowerCase(),
  temporaryPassword: z.string().min(8).max(200).optional(),
  role: z.enum(ROLES),
  organizationId: optionalId,
  departmentId: optionalId,
  propertyIds: z.array(z.string().trim().min(1)).default([]),
  staffingCompanyId: optionalId,
  status: z.enum(RecordStatus).default(RecordStatus.ACTIVE),
})

export type UserInput = z.infer<typeof userInputSchema>

export const resetPasswordSchema = z.object({
  temporaryPassword: z.string().min(8).max(200),
})

export const resetPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits."),
})

export const transferPropertySchema = z.object({
  propertyIds: z.array(z.string().trim().min(1)).default([]),
})

export const transferDepartmentSchema = z.object({
  departmentId: optionalId,
})

export const invitationInputSchema = z.object({
  firstName: requiredText,
  lastName: requiredText,
  email: z.email().trim().toLowerCase(),
  role: z.enum(ROLES),
  organizationId: optionalId,
  departmentId: optionalId,
  staffingCompanyId: optionalId,
})

export type InvitationInput = z.infer<typeof invitationInputSchema>
