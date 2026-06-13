import { OrganizationSubscriptionStatus } from "@prisma/client"

import { prisma } from "@/src/lib/prisma"
import {
  FeatureKey as FeatureKeys,
  type FeatureKey,
  type OrganizationFeatureAccess,
} from "@/src/lib/features/feature-keys"
import type { CurrentUser } from "@/src/lib/rbac/current-user"
import { AuthorizationError } from "@/src/lib/rbac/errors"
import { Role } from "@/src/lib/rbac/roles"

export type { FeatureKey, OrganizationFeatureAccess }

const featureField: Record<FeatureKey, keyof FeatureOverrideFlags> = {
  [FeatureKeys.SCHEDULING]: "canUseScheduling",
  [FeatureKeys.ATTENDANCE]: "canUseAttendance",
  [FeatureKeys.KIOSK]: "canUseKiosk",
  [FeatureKeys.TIMESHEETS]: "canUseTimesheets",
  [FeatureKeys.INVOICES]: "canUseInvoices",
  [FeatureKeys.PAYMENTS]: "canUsePayments",
  [FeatureKeys.REPORTS]: "canUseReports",
  [FeatureKeys.STAFFING]: "canUseStaffing",
}

type FeatureOverrideFlags = {
  canUseScheduling: boolean
  canUseAttendance: boolean
  canUseKiosk: boolean
  canUseTimesheets: boolean
  canUseInvoices: boolean
  canUsePayments: boolean
  canUseReports: boolean
  canUseStaffing: boolean
}

export async function getOrganizationFeatureAccess(
  organizationId: string,
): Promise<OrganizationFeatureAccess> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      subscription: {
        select: { status: true, trialEndsAt: true, endsAt: true },
      },
      featureOverride: {
        select: {
          canUseScheduling: true,
          canUseAttendance: true,
          canUseKiosk: true,
          canUseTimesheets: true,
          canUseInvoices: true,
          canUsePayments: true,
          canUseReports: true,
          canUseStaffing: true,
        },
      },
    },
  })
  if (!organization) throw new Error("Organization not found.")

  const subscriptionStatus = organization.subscription?.status ?? null
  const now = Date.now()
  const subscriptionActive =
    (subscriptionStatus === OrganizationSubscriptionStatus.ACTIVE ||
      subscriptionStatus === OrganizationSubscriptionStatus.TRIAL) &&
    (!organization.subscription?.trialEndsAt ||
      organization.subscription.trialEndsAt.getTime() >= now) &&
    (!organization.subscription?.endsAt ||
      organization.subscription.endsAt.getTime() >= now)

  // Missing entitlement records predate subscription enforcement and remain
  // enabled until they are explicitly configured by a platform administrator.
  const flags = organization.featureOverride
  const features = Object.fromEntries(
    Object.entries(featureField).map(([key, field]) => [
      key,
      flags ? flags[field] : true,
    ]),
  ) as Record<FeatureKey, boolean>

  return { subscriptionStatus, subscriptionActive, features }
}

export async function assertOrganizationFeatureAccess(
  user: CurrentUser,
  featureKey: FeatureKey,
) {
  if (user.role === Role.PLATFORM_OWNER || user.role === Role.PLATFORM_ADMIN) return
  if (!user.organizationId) {
    throw new AuthorizationError("Organization access is required for this feature.")
  }

  const access = await getOrganizationFeatureAccess(user.organizationId)
  if (!access.features[featureKey]) {
    throw new AuthorizationError("Requires active subscription or platform-approved access.", 403)
  }
}

export async function assertOrganizationFeatureAccessById(
  organizationId: string,
  featureKey: FeatureKey,
) {
  const access = await getOrganizationFeatureAccess(organizationId)
  if (!access.features[featureKey]) {
    throw new AuthorizationError("Requires active subscription or platform-approved access.", 403)
  }
}
