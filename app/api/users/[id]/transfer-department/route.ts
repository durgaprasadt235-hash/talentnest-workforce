import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"
import { transferUserDepartment } from "@/src/lib/users/service"
import { transferDepartmentSchema } from "@/src/lib/users/validation"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireServerPermission(request, Permission.MANAGE_USERS)
    const input = await parseJsonBody(request, transferDepartmentSchema)
    const { id } = await params
    return Response.json(await transferUserDepartment(id, input.departmentId ?? null, actor))
  } catch (error) {
    return errorResponse(error)
  }
}
