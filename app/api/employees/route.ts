import { createEmployee, listEmployees } from "@/src/lib/employees/service"
import { createEmployeeSchema } from "@/src/lib/employees/validation"
import { errorResponse, parseJsonBody } from "@/src/lib/http"
import { Permission } from "@/src/lib/rbac/permissions"
import { requireServerPermission } from "@/src/lib/rbac/server-guard"

export async function GET(request: Request) {
  try {
    requireServerPermission(request, Permission.VIEW_EMPLOYEES)
    return Response.json(await listEmployees())
  } catch (error) {
    return errorResponse(error, 500)
  }
}

export async function POST(request: Request) {
  try {
    requireServerPermission(request, Permission.MANAGE_EMPLOYEES)
    const input = await parseJsonBody(request, createEmployeeSchema)
    return Response.json({ employee: await createEmployee(input) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
