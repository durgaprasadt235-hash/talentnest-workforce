"use client"

import type { ReactNode } from "react"
import { LockKeyhole } from "lucide-react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { FeatureKey, type FeatureKey as FeatureKeyType } from "@/src/lib/features/feature-keys"
import { Role } from "@/src/lib/rbac/roles"

export function FeatureLock({
  feature,
  children,
}: {
  feature: FeatureKeyType
  children: ReactNode
}) {
  const { currentUser } = useCurrentUser()
  const bypass = currentUser.role === Role.PLATFORM_OWNER || currentUser.role === Role.PLATFORM_ADMIN
  const allowed = bypass || currentUser.featureAccess?.features[feature] !== false

  if (allowed) return children

  return (
    <div className="flex min-h-[28rem] items-center justify-center rounded-xl border border-dashed bg-card px-6 text-center">
      <div className="max-w-md">
        <LockKeyhole className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-4 font-semibold">Feature restricted</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Requires active subscription or platform-approved access.
        </p>
      </div>
    </div>
  )
}

export { FeatureKey }
