import { EmploymentType, RecordStatus } from "@prisma/client"
import { z } from "zod"

const optionalId = z.string().trim().min(1).max(100).nullable().optional()

const employeeFields = {
  organizationId: z.string().trim().min(1).max(100),
  propertyId: optionalId,
  departmentId: optionalId,
  employeeNumber: z.string().trim().min(1).max(50),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  employmentType: z.enum(EmploymentType),
  position: z.string().trim().max(200).nullable().optional(),
  staffingCompanyId: optionalId,
}

export const createEmployeeSchema = z
  .object(employeeFields)
  .superRefine(validateAgencyAssignment)

export const updateEmployeeSchema = z
  .object(employeeFields)
  .superRefine(validateAgencyAssignment)

export const employeeStatusSchema = z.object({
  status: z.enum([RecordStatus.ACTIVE, RecordStatus.INACTIVE]),
})

export const employeePinResetSchema = z
  .object({
    pin: z.string().regex(/^\d{4,12}$/, "PIN must contain 4 to 12 digits."),
    confirmPin: z.string(),
  })
  .refine((value) => value.pin === value.confirmPin, {
    message: "PIN confirmation does not match.",
    path: ["confirmPin"],
  })

function validateAgencyAssignment(
  value: { employmentType: EmploymentType; staffingCompanyId?: string | null },
  context: z.RefinementCtx,
) {
  if (
    value.employmentType === EmploymentType.AGENCY &&
    !value.staffingCompanyId
  ) {
    context.addIssue({
      code: "custom",
      message: "Agency employees must be assigned to a staffing company.",
      path: ["staffingCompanyId"],
    })
  }

  if (
    value.employmentType !== EmploymentType.AGENCY &&
    value.staffingCompanyId
  ) {
    context.addIssue({
      code: "custom",
      message: "Only agency employees can be assigned to a staffing company.",
      path: ["staffingCompanyId"],
    })
  }
}

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>
