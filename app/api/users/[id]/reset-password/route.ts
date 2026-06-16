import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { resetUserPassword } from "@/src/lib/users/service"
import { resetPasswordSchema } from "@/src/lib/users/validation"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireServerPermission(request, Permission.MANAGE_USERS)
    const input = await parseJsonBody(request, resetPasswordSchema)
    const { id } = await params
    return Response.json(await resetUserPassword(id, input.temporaryPassword, actor))
  } catch (error) {
    return errorResponse(error)
  }
}
