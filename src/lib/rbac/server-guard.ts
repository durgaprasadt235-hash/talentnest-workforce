import { DEFAULT_CURRENT_USER, type CurrentUser } from "@/src/lib/rbac/current-user"
import { hasPermission } from "@/src/lib/rbac/guards"
import { MOCK_ROLE_HEADER } from "@/src/lib/rbac/mock-auth"
import type { Permission } from "@/src/lib/rbac/permissions"
import { ROLES } from "@/src/lib/rbac/roles"

export class AuthorizationError extends Error {
  readonly status = 403
}

export function getServerCurrentUser(request: Request): CurrentUser {
  const requestedRole = request.headers.get(MOCK_ROLE_HEADER)
  const role = ROLES.find((candidate) => candidate === requestedRole)

  return { role: role ?? DEFAULT_CURRENT_USER.role }
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
