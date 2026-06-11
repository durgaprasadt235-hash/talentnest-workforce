import {
  createMockCurrentUser,
  DEFAULT_CURRENT_USER,
  type CurrentUser,
} from "@/src/lib/rbac/current-user"
import { hasPermission } from "@/src/lib/rbac/guards"
import {
  MOCK_ORGANIZATION_HEADER,
  MOCK_PROPERTY_IDS_HEADER,
  MOCK_ROLE_HEADER,
  MOCK_STAFFING_COMPANY_HEADER,
} from "@/src/lib/rbac/mock-auth"
import type { Permission } from "@/src/lib/rbac/permissions"
import { ROLES } from "@/src/lib/rbac/roles"

export class AuthorizationError extends Error {
  readonly status = 403
}

export function getServerCurrentUser(request: Request): CurrentUser {
  const requestedRole = request.headers.get(MOCK_ROLE_HEADER)
  const role = ROLES.find((candidate) => candidate === requestedRole)
  const organizationId = request.headers.get(MOCK_ORGANIZATION_HEADER) ?? undefined
  const propertyIdsRaw = request.headers.get(MOCK_PROPERTY_IDS_HEADER)
  const staffingCompanyId = request.headers.get(MOCK_STAFFING_COMPANY_HEADER) ?? undefined

  let propertyIds: string[] | undefined
  if (propertyIdsRaw) {
    try {
      propertyIds = JSON.parse(propertyIdsRaw)
    } catch {
      propertyIds = undefined
    }
  }

  return createMockCurrentUser(role ?? DEFAULT_CURRENT_USER.role, {
    ...(organizationId ? { organizationId } : {}),
    ...(propertyIds ? { propertyIds } : {}),
    ...(staffingCompanyId ? { staffingCompanyId } : {}),
  })
}

export function requireServerPermission(
  request: Request,
  permission: Permission,
): CurrentUser {
  const user = getServerCurrentUser(request)

  if (!hasPermission(user, permission)) {
    throw new AuthorizationError("You do not have permission for this action.")
  }

  return user
}
