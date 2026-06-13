"use client"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { Role } from "@/src/lib/rbac/roles"

export function SubscriptionBanner() {
  const { currentUser } = useCurrentUser()
  const isPlatform = currentUser.role === Role.PLATFORM_OWNER || currentUser.role === Role.PLATFORM_ADMIN

  if (isPlatform || !currentUser.organizationId || currentUser.featureAccess?.subscriptionActive !== false) {
    return null
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-900 sm:px-6 lg:px-10">
      Subscription not active. Setup is available, but operational features are restricted.
    </div>
  )
}
