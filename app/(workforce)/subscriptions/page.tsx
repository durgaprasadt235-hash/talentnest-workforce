import type { Metadata } from "next"

import { BillingPlans } from "@/components/billing/billing-plans"
import { isStripeConfigured } from "@/src/lib/stripe/server"

export const metadata: Metadata = { title: "Subscriptions" }

export default function Page() {
  return <BillingPlans title="Subscriptions" configured={isStripeConfigured()} />
}
