import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { setUserStatus } from "@/src/lib/users/service"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_USERS)
    const { id } = await params
    return Response.json(await setUserStatus(id, "INACTIVE", user))
  } catch (error) {
    return errorResponse(error)
  }
}
