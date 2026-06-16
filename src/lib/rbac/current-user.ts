import { Role } from "@/src/lib/rbac/roles"
import type { OrganizationFeatureAccess } from "@/src/lib/features/feature-keys"
import type { Permission } from "@/src/lib/rbac/permissions"

export type CurrentUser = {
  id?: string
  email?: string
  firstName?: string
  lastName?: string
  role: Role
  organizationId?: string
  propertyIds?: string[]
  staffingCompanyId?: string
  departmentId?: string
  companyName?: string
  mustChangePassword?: boolean
  featureAccess?: OrganizationFeatureAccess
  permissions?: Permission[]
}

export const DEFAULT_CURRENT_USER: CurrentUser = {
  role: Role.EMPLOYEE,
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
