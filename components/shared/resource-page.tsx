"use client"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { hasPermission } from "@/src/lib/rbac/guards"
import type { Permission } from "@/src/lib/rbac/permissions"

type ResourcePageProps = {
  title: string
  requiredPermission?: Permission
}

export function ResourcePage({
  title,
  requiredPermission,
}: ResourcePageProps) {
  const { currentUser } = useCurrentUser()
  const allowed =
    !requiredPermission || hasPermission(currentUser, requiredPermission)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      <section
        aria-label={`${title} content`}
        className="flex min-h-[28rem] items-center justify-center rounded-xl border border-dashed bg-card"
      >
        {allowed ? (
          <p className="text-sm font-medium text-muted-foreground">
            Coming Soon
          </p>
        ) : (
          <div className="max-w-md px-6 text-center">
            <p className="font-semibold text-foreground">Access Denied</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Your current role does not have permission to view this page.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
