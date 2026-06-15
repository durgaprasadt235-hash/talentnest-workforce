import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { saveDepartmentRole } from "@/src/lib/operations/service"
import { departmentRoleSchema } from "@/src/lib/operations/validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_DEPARTMENTS)
    return Response.json({ role: await saveDepartmentRole(await parseJsonBody(request, departmentRoleSchema), user, (await context.params).id) })
  } catch (error) {
    return errorResponse(error)
  }
}
