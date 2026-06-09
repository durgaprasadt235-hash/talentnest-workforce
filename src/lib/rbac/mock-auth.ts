import type { Role } from "@/src/lib/rbac/roles"

export const MOCK_ROLE_HEADER = "x-talentnest-mock-role"

export function mockRoleHeaders(role: Role) {
  return { [MOCK_ROLE_HEADER]: role }
}
