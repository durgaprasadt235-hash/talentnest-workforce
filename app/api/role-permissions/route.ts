import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { listRolePermissions, updateRolePermission } from "@/src/lib/rbac/permission-service"
import { rolePermissionSchema } from "@/src/lib/rbac/permission-validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { Role } from "@/src/lib/rbac/roles"

export async function GET(request: Request) {
  try {
    const actor = await requireServerPermission(request, Permission.VIEW_USERS)
    if (actor.role !== Role.PLATFORM_OWNER && actor.role !== Role.PLATFORM_ADMIN && actor.role !== Role.PLATFORM_OPERATIONS) {
      return Response.json({ error: "Only platform roles can view the permission matrix." }, { status: 403 })
    }
    return Response.json({ permissions: await listRolePermissions() })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireServerPermission(request, Permission.MANAGE_USERS)
    if (actor.role !== Role.PLATFORM_OWNER) {
      return Response.json({ error: "Only the platform owner can update the permission matrix." }, { status: 403 })
    }
    const input = await parseJsonBody(request, rolePermissionSchema)
    return Response.json(await updateRolePermission(input))
  } catch (error) {
    return errorResponse(error)
  }
}
