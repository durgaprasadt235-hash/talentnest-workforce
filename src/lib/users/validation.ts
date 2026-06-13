import { RecordStatus } from "@prisma/client"
import { z } from "zod"

import { ROLES } from "@/src/lib/rbac/roles"

const requiredText = z.string().trim().min(1).max(200)
const optionalId = z.string().trim().min(1).nullable().optional()

export const userInputSchema = z.object({
  firstName: requiredText,
  lastName: requiredText,
  email: z.email().trim().toLowerCase(),
  role: z.enum(ROLES),
  organizationId: optionalId,
  propertyIds: z.array(z.string().trim().min(1)).default([]),
  staffingCompanyId: optionalId,
  status: z.enum(RecordStatus).default(RecordStatus.ACTIVE),
})

export type UserInput = z.infer<typeof userInputSchema>
