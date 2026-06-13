import { z } from "zod"

import { BillingCycle, billingPlans } from "@/src/lib/stripe/plans"

const planKeys = billingPlans.map((plan) => plan.key)

export const checkoutSessionSchema = z.object({
  organizationId: z.string().trim().min(1),
  planKey: z.enum(planKeys),
  billingCycle: z.enum(BillingCycle),
})
