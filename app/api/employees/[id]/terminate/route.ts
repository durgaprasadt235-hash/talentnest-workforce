import { terminateEmployee } from "@/src/lib/employees/service"
import { terminateEmployeeSchema } from "@/src/lib/employees/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireServerPermission(request, Permission.MANAGE_EMPLOYEES)
    const { id } = await params
    const { reason } = await parseJsonBody(request, terminateEmployeeSchema)
    return Response.json({ employee: await terminateEmployee(id, reason) })
  } catch (error) {
    return errorResponse(error)
  }
}
