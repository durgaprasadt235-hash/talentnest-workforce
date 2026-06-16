import { z } from "zod"

import { ROLES } from "@/src/lib/rbac/roles"
import { permissionModules } from "@/src/lib/rbac/permission-service"

export const rolePermissionSchema = z.object({
  role: z.enum(ROLES),
  module: z.enum(permissionModules as [string, ...string[]]),
  canView: z.boolean(),
  canCreate: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canApprove: z.boolean(),
  canExport: z.boolean(),
})
