import type { Metadata } from "next"

import { BillingPlans } from "@/components/billing/billing-plans"
import { isStripeConfigured } from "@/src/lib/stripe/server"

export const metadata: Metadata = { title: "Platform Billing" }

export default function Page() {
  return <BillingPlans title="Platform Billing" configured={isStripeConfigured()} />
}
