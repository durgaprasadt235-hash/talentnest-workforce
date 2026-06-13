export const FeatureKey = {
  SCHEDULING: "SCHEDULING",
  ATTENDANCE: "ATTENDANCE",
  KIOSK: "KIOSK",
  TIMESHEETS: "TIMESHEETS",
  INVOICES: "INVOICES",
  PAYMENTS: "PAYMENTS",
  REPORTS: "REPORTS",
  STAFFING: "STAFFING",
} as const

export type FeatureKey = (typeof FeatureKey)[keyof typeof FeatureKey]

export type OrganizationFeatureAccess = {
  subscriptionStatus: string | null
  subscriptionActive: boolean
  features: Record<FeatureKey, boolean>
}
