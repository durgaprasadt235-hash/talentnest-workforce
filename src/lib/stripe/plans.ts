export const BillingCycle = {
  MONTHLY: "monthly",
  ANNUAL: "annual",
} as const

export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle]

export const billingPlans = [
  {
    key: "starter",
    name: "Starter",
    monthlyPriceIdEnvKey: "STRIPE_PRICE_STARTER_MONTHLY",
    annualPriceIdEnvKey: "STRIPE_PRICE_STARTER_ANNUAL",
    maxProperties: 3,
    maxEmployees: 150,
    maxUsers: 15,
    features: ["Core workforce management", "Attendance kiosk", "Weekly attendance"],
  },
  {
    key: "growth",
    name: "Growth",
    monthlyPriceIdEnvKey: "STRIPE_PRICE_GROWTH_MONTHLY",
    annualPriceIdEnvKey: "STRIPE_PRICE_GROWTH_ANNUAL",
    maxProperties: 15,
    maxEmployees: 1_000,
    maxUsers: 75,
    features: ["Everything in Starter", "Staffing company workflows", "Advanced reporting"],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    monthlyPriceIdEnvKey: "STRIPE_PRICE_ENTERPRISE_MONTHLY",
    annualPriceIdEnvKey: "STRIPE_PRICE_ENTERPRISE_ANNUAL",
    maxProperties: null,
    maxEmployees: null,
    maxUsers: null,
    features: ["Everything in Growth", "Unlimited scale", "Priority platform support"],
  },
] as const

export type BillingPlanKey = (typeof billingPlans)[number]["key"]

export function getBillingPlan(planKey: BillingPlanKey) {
  return billingPlans.find((plan) => plan.key === planKey)
}

export function getStripePriceId(planKey: BillingPlanKey, billingCycle: BillingCycle) {
  const plan = getBillingPlan(planKey)
  if (!plan) return undefined

  const envKey =
    billingCycle === BillingCycle.MONTHLY
      ? plan.monthlyPriceIdEnvKey
      : plan.annualPriceIdEnvKey

  return process.env[envKey]
}
