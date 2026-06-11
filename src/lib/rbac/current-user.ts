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

const MOCK_ROLE_CONTEXT: Partial<Record<Role, Omit<CurrentUser, "role">>> = {
  [Role.PROPERTY_MANAGER]: {
    propertyIds: ["seed-best-western-erie"],
  },
}

export function createMockCurrentUser(
  role: Role,
  context?: Omit<CurrentUser, "role">,
): CurrentUser {
  return {
    role,
    ...MOCK_ROLE_CONTEXT[role],
    ...context,
  }
}
