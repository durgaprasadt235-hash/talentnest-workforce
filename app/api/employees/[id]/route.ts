import { deleteEmployee, updateEmployee } from "@/src/lib/employees/service"
import { updateEmployeeSchema } from "@/src/lib/employees/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_EMPLOYEES)
    const { id } = await params
    const input = await parseJsonBody(request, updateEmployeeSchema)
    return Response.json({ employee: await updateEmployee(id, input, user) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_EMPLOYEES)
    const { id } = await params
    return Response.json({ employee: await deleteEmployee(id, user) })
  } catch (error) {
    return errorResponse(error)
  }
}
