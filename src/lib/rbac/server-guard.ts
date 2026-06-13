import {
  createMockCurrentUser,
  type CurrentUser,
} from "@/src/lib/rbac/current-user"
import { resolveClerkCurrentUser } from "@/src/lib/rbac/clerk-user"
import { AuthorizationError } from "@/src/lib/rbac/errors"
import { hasPermission } from "@/src/lib/rbac/guards"
import {
  MOCK_ORGANIZATION_HEADER,
  MOCK_PROPERTY_IDS_HEADER,
  MOCK_ROLE_HEADER,
  MOCK_STAFFING_COMPANY_HEADER,
} from "@/src/lib/rbac/mock-auth"
import type { Permission } from "@/src/lib/rbac/permissions"
import { ROLES } from "@/src/lib/rbac/roles"

export { AuthorizationError } from "@/src/lib/rbac/errors"

export async function getServerCurrentUser(request: Request): Promise<CurrentUser> {
  if (process.env.NODE_ENV !== "production") {
    const mockUser = getDevelopmentMockUser(request)
    if (mockUser) return mockUser
  }

  return resolveClerkCurrentUser()
}

function getDevelopmentMockUser(request: Request): CurrentUser | null {
  const requestedRole = request.headers.get(MOCK_ROLE_HEADER)
  const role = ROLES.find((candidate) => candidate === requestedRole)
  if (!role) return null

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

  return createMockCurrentUser(role, {
    ...(organizationId ? { organizationId } : {}),
    ...(propertyIds ? { propertyIds } : {}),
    ...(staffingCompanyId ? { staffingCompanyId } : {}),
  })
}

export function requireServerPermission(
  request: Request,
  permission: Permission,
): Promise<CurrentUser> {
  return requirePermission(request, permission)
}

export async function requireClerkPermission(
  permission: Permission,
): Promise<CurrentUser> {
  const user = await resolveClerkCurrentUser()

  if (!hasPermission(user, permission)) {
    throw new AuthorizationError("You do not have permission for this action.")
  }

  return user
}

async function requirePermission(
  request: Request,
  permission: Permission,
): Promise<CurrentUser> {
  const user = await getServerCurrentUser(request)

  if (!hasPermission(user, permission)) {
    throw new AuthorizationError("You do not have permission for this action.")
  }

  return user
}
