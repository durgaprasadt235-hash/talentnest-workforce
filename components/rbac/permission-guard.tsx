"use client"

import type { ReactNode } from "react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"
import { hasPermission } from "@/src/lib/rbac/guards"
import type { Permission } from "@/src/lib/rbac/permissions"

export function PermissionGuard({
  permission,
  children,
}: {
  permission: Permission
  children: ReactNode
}) {
  const { currentUser } = useCurrentUser()

  if (!hasPermission(currentUser, permission)) {
    return (
      <div className="space-y-8">
        <h1 className="text-3xl font-semibold tracking-tight">Access Denied</h1>
        <section className="flex min-h-[28rem] items-center justify-center rounded-xl border border-dashed bg-card px-6 text-center text-sm text-muted-foreground">
          Your current role does not have permission to view this page.
        </section>
      </div>
    )
  }

  return children
}
