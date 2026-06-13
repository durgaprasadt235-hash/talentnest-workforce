import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { updateDepartment } from "@/src/lib/master-data/service"
import { departmentSchema } from "@/src/lib/master-data/validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

type Context = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Context) {
  try {
    await requireServerPermission(request, Permission.MANAGE_DEPARTMENTS)
    const input = await parseJsonBody(request, departmentSchema)
    return Response.json({ department: await updateDepartment((await params).id, input) })
  } catch (error) {
    return errorResponse(error)
  }
}
