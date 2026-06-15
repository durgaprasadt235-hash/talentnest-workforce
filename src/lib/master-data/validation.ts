import { DepartmentType, RecordStatus } from "@prisma/client"
import { z } from "zod"

const requiredText = z.string().trim().min(1).max(200)
const optionalText = z.string().trim().max(500).nullable().optional()

export const organizationSchema = z.object({
  name: requiredText,
  slug: z.string().trim().min(1).max(100),
  status: z.enum(RecordStatus).optional(),
})

export const propertySchema = z.object({
  organizationId: requiredText,
  legalEntityId: z.string().trim().min(1).nullable().optional(),
  name: requiredText,
  code: z.string().trim().max(50).nullable().optional(),
  brand: optionalText,
  status: z.enum(RecordStatus).optional(),
  address: optionalText,
  addressLine2: optionalText,
  city: optionalText,
  state: optionalText,
  zipCode: optionalText,
  timeZone: z.string().trim().min(1).max(100),
})

export const legalEntitySchema = z.object({
  organizationId: requiredText,
  legalName: requiredText,
  displayName: requiredText,
  ein: optionalText,
  address: optionalText,
  city: optionalText,
  state: optionalText,
  zipCode: optionalText,
  status: z.enum(RecordStatus).optional(),
})

export const departmentSchema = z.object({
  organizationId: requiredText,
  propertyId: requiredText,
  name: requiredText,
  code: z.string().trim().max(50).nullable().optional(),
  type: z.enum(DepartmentType).optional(),
  status: z.enum(RecordStatus).optional(),
})

export type OrganizationInput = z.infer<typeof organizationSchema>
export type PropertyInput = z.infer<typeof propertySchema>
export type LegalEntityInput = z.infer<typeof legalEntitySchema>
export type DepartmentInput = z.infer<typeof departmentSchema>
