import { setEmployeeStatus } from "@/src/lib/employees/service"
import { employeeStatusSchema } from "@/src/lib/employees/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireServerPermission(request, Permission.MANAGE_EMPLOYEES)
    const { id } = await params
    const { status } = await parseJsonBody(request, employeeStatusSchema)
    return Response.json({
      employee: await setEmployeeStatus(id, status),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
