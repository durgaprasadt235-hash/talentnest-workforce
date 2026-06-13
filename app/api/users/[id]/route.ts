import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { updateUser } from "@/src/lib/users/service"
import { userInputSchema } from "@/src/lib/users/validation"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_USERS)
    const input = await parseJsonBody(request, userInputSchema)
    const { id } = await params
    return Response.json(await updateUser(id, input, user))
  } catch (error) {
    return errorResponse(error)
  }
}
