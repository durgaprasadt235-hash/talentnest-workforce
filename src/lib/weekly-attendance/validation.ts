import { z } from "zod"

const requiredText = z.string().trim().min(1).max(200)

export const generateWeeklyAttendanceSchema = z.object({
  organizationId: requiredText,
  propertyId: requiredText,
  weekStartDate: z.iso.date(),
})

export const approveWeeklyAttendanceSchema = z.object({
  overrideNote: z.string().trim().max(2_000).optional(),
  approvedByUserId: requiredText.optional(),
})

export const requestWeeklyAttendanceCorrectionsSchema = z.object({
  managerNote: requiredText.max(2_000),
})

export type GenerateWeeklyAttendanceInput = z.infer<
  typeof generateWeeklyAttendanceSchema
>
export type ApproveWeeklyAttendanceInput = z.infer<
  typeof approveWeeklyAttendanceSchema
>
export type RequestWeeklyAttendanceCorrectionsInput = z.infer<
  typeof requestWeeklyAttendanceCorrectionsSchema
>
