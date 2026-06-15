"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"

import { useCurrentUser } from "@/components/rbac/current-user-provider"

export function PasswordChangeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { currentUser } = useCurrentUser()

  useEffect(() => {
    if (currentUser.mustChangePassword && pathname !== "/change-password") {
      router.replace("/change-password")
    }
  }, [currentUser.mustChangePassword, pathname, router])

  if (currentUser.mustChangePassword && pathname !== "/change-password") return null
  return children
}
