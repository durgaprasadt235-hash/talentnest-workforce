import { errorResponse } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { resendUserInvitation } from "@/src/lib/users/invitations"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireServerPermission(request, Permission.MANAGE_USERS)
    const { id } = await params
    return Response.json(await resendUserInvitation(id, actor))
  } catch (error) {
    return errorResponse(error)
  }
}
