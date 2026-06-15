import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { listDepartmentRoles, saveDepartmentRole } from "@/src/lib/operations/service"
import { departmentRoleSchema } from "@/src/lib/operations/validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function GET(request: Request) {
  try {
    const user = await requireServerPermission(request, Permission.VIEW_DEPARTMENTS)
    return Response.json({ roles: await listDepartmentRoles(user, new URL(request.url).searchParams.get("departmentId") ?? undefined) })
  } catch (error) {
    return errorResponse(error, 500)
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireServerPermission(request, Permission.MANAGE_DEPARTMENTS)
    return Response.json({ role: await saveDepartmentRole(await parseJsonBody(request, departmentRoleSchema), user) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
