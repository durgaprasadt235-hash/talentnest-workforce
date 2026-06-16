import type { CurrentUser } from "@/src/lib/rbac/current-user"
import {
  ROLE_PERMISSIONS,
  type Permission,
} from "@/src/lib/rbac/permissions"
import type { Role } from "@/src/lib/rbac/roles"

export function roleHasPermission(
  role: Role,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

export function hasPermission(
  user: CurrentUser,
  permission: Permission,
): boolean {
  if (user.permissions) return user.permissions.includes(permission)
  return roleHasPermission(user.role, permission)
}

export function hasAnyPermission(
  user: CurrentUser,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => hasPermission(user, permission))
}

export function hasAllPermissions(
  user: CurrentUser,
  permissions: readonly Permission[],
): boolean {
  return permissions.every((permission) => hasPermission(user, permission))
}
