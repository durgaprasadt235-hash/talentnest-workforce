import { z } from "zod"

const requiredText = z.string().trim().min(1).max(200)
const optionalText = z.string().trim().max(500).nullable().optional()

export const onboardingSubscriptionOptions = [
  "trial-30",
  "starter-monthly",
  "starter-annual",
  "growth-monthly",
  "growth-annual",
  "enterprise-manual",
] as const

export const organizationOnboardingSchema = z.object({
  organization: z.object({
    name: requiredText,
    slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens."),
    legalBusinessName: requiredText,
    contactName: requiredText,
    contactEmail: z.email().trim().toLowerCase(),
    contactPhone: optionalText,
    billingAddress: optionalText,
    billingCity: optionalText,
    billingState: optionalText,
    billingZip: optionalText,
  }),
  owner: z.object({
    firstName: requiredText,
    lastName: requiredText,
    email: z.email().trim().toLowerCase(),
    temporaryPassword: z.string().min(8).max(200),
  }),
  subscriptionOption: z.enum(onboardingSubscriptionOptions),
  features: z.object({
    canUseScheduling: z.boolean(),
    canUseAttendance: z.boolean(),
    canUseTimesheets: z.boolean(),
    canUseInvoices: z.boolean(),
    canUsePayments: z.boolean(),
    canUseReports: z.boolean(),
    canUseKiosk: z.boolean(),
    canUseStaffing: z.boolean(),
    reason: optionalText,
  }),
})

export const organizationFeatureOverrideSchema = z.object({
  canUseScheduling: z.boolean(),
  canUseAttendance: z.boolean(),
  canUseTimesheets: z.boolean(),
  canUseInvoices: z.boolean(),
  canUsePayments: z.boolean(),
  canUseReports: z.boolean(),
  canUseKiosk: z.boolean(),
  canUseStaffing: z.boolean(),
  reason: optionalText,
})

export type OrganizationOnboardingInput = z.infer<typeof organizationOnboardingSchema>
export type OnboardingSubscriptionOption = OrganizationOnboardingInput["subscriptionOption"]
export type OrganizationFeatureOverrideInput = z.infer<typeof organizationFeatureOverrideSchema>
