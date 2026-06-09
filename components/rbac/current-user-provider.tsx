"use client"

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  createMockCurrentUser,
  DEFAULT_CURRENT_USER,
  type CurrentUser,
} from "@/src/lib/rbac/current-user"
import type { Role } from "@/src/lib/rbac/roles"

type CurrentUserContextValue = {
  currentUser: CurrentUser
  setCurrentRole: (role: Role) => void
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null)

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [role, setCurrentRole] = useState<Role>(DEFAULT_CURRENT_USER.role)
  const value = useMemo(
    () => ({ currentUser: createMockCurrentUser(role), setCurrentRole }),
    [role],
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
