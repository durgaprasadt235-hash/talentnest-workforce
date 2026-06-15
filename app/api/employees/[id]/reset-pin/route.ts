import { resetEmployeePin } from "@/src/lib/employees/service"
import { employeePinResetSchema } from "@/src/lib/employees/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_EMPLOYEES)
    const { id } = await params
    const { pin } = await parseJsonBody(request, employeePinResetSchema)
    return Response.json({ employee: await resetEmployeePin(id, pin, user) })
  } catch (error) {
    return errorResponse(error)
  }
}
