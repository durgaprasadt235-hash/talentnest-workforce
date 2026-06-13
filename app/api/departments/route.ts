import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { createDepartment, listDepartments } from "@/src/lib/master-data/service"
import { departmentSchema } from "@/src/lib/master-data/validation"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function GET(request: Request) {
  try {
    await requireServerPermission(request, Permission.VIEW_DEPARTMENTS)
    return Response.json(await listDepartments())
  } catch (error) {
    return errorResponse(error, 500)
  }
}

export async function POST(request: Request) {
  try {
    await requireServerPermission(request, Permission.MANAGE_DEPARTMENTS)
    const input = await parseJsonBody(request, departmentSchema)
    return Response.json({ department: await createDepartment(input) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
