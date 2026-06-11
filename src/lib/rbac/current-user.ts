import { Role } from "@/src/lib/rbac/roles"

export type CurrentUser = {
  role: Role
  organizationId?: string
  propertyIds?: string[]
  staffingCompanyId?: string
}

export const DEFAULT_CURRENT_USER: CurrentUser = {
  role: Role.CORPORATE_ADMIN,
}

export function createMockCurrentUser(role: Role, context?: { organizationId?: string; propertyIds?: string[]; staffingCompanyId?: string }): CurrentUser {
  return { role, ...context }
}
