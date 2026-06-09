import { Role } from "@/src/lib/rbac/roles"

export type CurrentUser = {
  role: Role
}

export const DEFAULT_CURRENT_USER: CurrentUser = {
  role: Role.CORPORATE_ADMIN,
}

export function createMockCurrentUser(role: Role): CurrentUser {
  return { role }
}
