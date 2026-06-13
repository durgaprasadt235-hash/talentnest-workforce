"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  createMockCurrentUser,
  type CurrentUser,
} from "@/src/lib/rbac/current-user"
import { Role } from "@/src/lib/rbac/roles"

type CurrentUserContextValue = {
  currentUser: CurrentUser
  setCurrentRole: (role: Role) => void
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null)

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(() =>
    createMockCurrentUser(Role.EMPLOYEE),
  )

  useEffect(() => {
    let cancelled = false

    async function loadCurrentUser() {
      const response = await fetch("/api/auth/me")
      if (!response.ok) return

      const user = (await response.json()) as CurrentUser & {
        organizationId: string | null
        staffingCompanyId: string | null
      }
      if (!cancelled) {
        setCurrentUser({
          ...user,
          organizationId: user.organizationId ?? undefined,
          staffingCompanyId: user.staffingCompanyId ?? undefined,
        })
      }
    }

    loadCurrentUser().catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [])

  function setCurrentRole(role: Role) {
    if (process.env.NODE_ENV !== "production") {
      setCurrentUser((user) =>
        createMockCurrentUser(role, {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          organizationId: user.organizationId,
          propertyIds: user.propertyIds,
          staffingCompanyId: user.staffingCompanyId,
          companyName: user.companyName,
        }),
      )
    }
  }

  const value = useMemo(
    () => ({ currentUser, setCurrentRole }),
    [currentUser],
  )

  return (
    <CurrentUserContext.Provider value={value}>
      {children}
    </CurrentUserContext.Provider>
  )
}

export function useCurrentUser() {
  const context = useContext(CurrentUserContext)

  if (!context) {
    throw new Error("useCurrentUser must be used within CurrentUserProvider")
  }

  return context
}
